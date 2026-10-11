import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type AuthSessionDto,
  type RoomDto,
  type VoiceJoined,
  type VoicePeerLeftMessage,
  type VoicePeerMessage,
  type VoiceSignal,
  type VoiceSignalMessage,
} from '@bgp/shared-types';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface Client {
  session: AuthSessionDto;
  socket: Socket;
  joined: VoicePeerMessage[];
  left: VoicePeerLeftMessage[];
  muted: VoicePeerMessage[];
  signals: VoiceSignalMessage[];
  api<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }>;
  emit<T>(event: string, payload?: unknown): Promise<Ack<T>>;
}

const OFFER: VoiceSignal = { description: { type: 'offer', sdp: 'v=0' } };

describe('voice calls', () => {
  let app: INestApplication;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    process.env.JWT_SECRET = 'test-secret';
    process.env.VOICE_MAX_PEERS = '3';
    delete process.env.VOICE_ICE_SERVERS;

    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app?.close();
  });

  async function request<T>(method: string, path: string, token?: string, body?: unknown) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as T };
  }

  function connect(token: string): Promise<Socket> {
    const socket = io(baseUrl, { auth: { token }, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function listen(session: AuthSessionDto, socket: Socket): Client {
    const client: Client = {
      session,
      socket,
      joined: [],
      left: [],
      muted: [],
      signals: [],
      api: (method, path, body) => request(method, path, session.accessToken, body),
      emit: (event, payload) => socket.emitWithAck(event, payload),
    };
    socket.on(ServerEvents.VoicePeerJoined, (message) => client.joined.push(message));
    socket.on(ServerEvents.VoicePeerLeft, (message) => client.left.push(message));
    socket.on(ServerEvents.VoicePeerMuted, (message) => client.muted.push(message));
    socket.on(ServerEvents.VoiceSignal, (message) => client.signals.push(message));
    return client;
  }

  async function createClient(displayName: string): Promise<Client> {
    const { body: session } = await request<AuthSessionDto>('POST', '/auth/guest', undefined, {
      displayName,
    });
    return listen(session, await connect(session.accessToken));
  }

  async function waitFor<T>(read: () => T | undefined, what: string): Promise<T> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const value = read();
      if (value !== undefined) return value;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${what}`);
  }

  /** A room with everyone in `members` seated in it. The first is its host. */
  async function roomOf(...members: Client[]): Promise<RoomDto> {
    const [host, ...guests] = members as [Client, ...Client[]];
    const { body: room } = await host.api<RoomDto>('POST', '/rooms', { gameType: 'splendor' });
    for (const guest of guests) await guest.api('POST', `/rooms/${room.id}/join`);
    return room;
  }

  const join = (client: Client, roomId: string) =>
    client.emit<VoiceJoined>(ClientEvents.VoiceJoin, { roomId });

  it('lets the members of a room into its call and tells each of the others', async () => {
    const [alice, bob] = [await createClient('VoiceAlice'), await createClient('VoiceBob')];
    const room = await roomOf(alice, bob);

    const first = await join(alice, room.id);
    expect(first).toMatchObject({ ok: true, data: { roomId: room.id, peers: [] } });
    if (!first.ok) throw new Error('alice was refused');
    expect(first.data.peerId).toBe(alice.socket.id);
    expect(first.data.iceServers.length).toBeGreaterThan(0);

    const second = await join(bob, room.id);
    if (!second.ok) throw new Error('bob was refused');
    // The newcomer is told who is there; the one already there is told who came.
    expect(second.data.peers).toEqual([
      {
        peerId: alice.socket.id,
        userId: alice.session.user.id,
        displayName: 'VoiceAlice',
        muted: false,
      },
    ]);
    const told = await waitFor(() => alice.joined[0], 'alice to hear that bob joined');
    expect(told).toEqual({
      roomId: room.id,
      peer: {
        peerId: bob.socket.id,
        userId: bob.session.user.id,
        displayName: 'VoiceBob',
        muted: false,
      },
    });
    expect(bob.joined).toEqual([]);

    // Asking again for the call one is in changes nothing and tells nobody.
    expect(await join(bob, room.id)).toMatchObject({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(alice.joined).toHaveLength(1);
  });

  it('passes a signal to the one it names, and to nobody else', async () => {
    const [alice, bob, carol] = [
      await createClient('SignalAlice'),
      await createClient('SignalBob'),
      await createClient('SignalCarol'),
    ];
    const room = await roomOf(alice, bob, carol);
    for (const client of [alice, bob, carol]) expect((await join(client, room.id)).ok).toBe(true);

    const sent = await alice.emit(ClientEvents.VoiceSignal, {
      roomId: room.id,
      toPeerId: bob.socket.id,
      signal: OFFER,
    });
    expect(sent).toEqual({ ok: true, data: null });
    const received = await waitFor(() => bob.signals[0], 'bob to get the offer');
    expect(received).toEqual({ roomId: room.id, fromPeerId: alice.socket.id, signal: OFFER });
    expect(carol.signals).toEqual([]);

    const candidate: VoiceSignal = {
      candidate: {
        candidate: 'candidate:1 1 udp 1 127.0.0.1 9 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    };
    await bob.emit(ClientEvents.VoiceSignal, {
      roomId: room.id,
      toPeerId: alice.socket.id,
      signal: candidate,
    });
    expect(await waitFor(() => alice.signals[0], 'alice to get the candidate')).toMatchObject({
      fromPeerId: bob.socket.id,
      signal: candidate,
    });
  });

  it('keeps out anyone who is not a member, and their signals with them', async () => {
    const [alice, mallory] = [await createClient('MemberAlice'), await createClient('Mallory')];
    const room = await roomOf(alice);
    expect((await join(alice, room.id)).ok).toBe(true);

    expect(await join(mallory, room.id)).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.NotRoomMember },
    });
    const forged = await mallory.emit(ClientEvents.VoiceSignal, {
      roomId: room.id,
      toPeerId: alice.socket.id,
      signal: OFFER,
    });
    expect(forged).toMatchObject({ ok: false, error: { code: ErrorCodes.NotInVoice } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(alice.signals).toEqual([]);
    expect(alice.joined).toEqual([]);

    expect(
      await alice.emit(ClientEvents.VoiceSignal, { roomId: room.id, toPeerId: 'x', signal: {} }),
    ).toMatchObject({ ok: false, error: { code: ErrorCodes.ValidationFailed } });
  });

  it('turns a joiner away from a full call', async () => {
    const clients = await Promise.all(
      ['FullA', 'FullB', 'FullC', 'FullD'].map((name) => createClient(name)),
    );
    const room = await roomOf(...clients);
    const [a, b, c, d] = clients as [Client, Client, Client, Client];
    for (const client of [a, b, c]) expect((await join(client, room.id)).ok).toBe(true);
    expect(await join(d, room.id)).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.VoiceFull },
    });

    // A place opens when someone leaves.
    expect(await a.emit(ClientEvents.VoiceLeave)).toEqual({ ok: true, data: null });
    expect((await join(d, room.id)).ok).toBe(true);
  });

  it('tells the call when someone mutes, leaves, or loses their connection', async () => {
    const [alice, bob, carol] = [
      await createClient('LeaveAlice'),
      await createClient('LeaveBob'),
      await createClient('LeaveCarol'),
    ];
    const room = await roomOf(alice, bob, carol);
    for (const client of [alice, bob, carol]) expect((await join(client, room.id)).ok).toBe(true);
    const bobId = bob.socket.id;
    const carolId = carol.socket.id;

    await bob.emit(ClientEvents.VoiceMute, { roomId: room.id, muted: true });
    expect(await waitFor(() => alice.muted[0], 'alice to hear bob muted')).toMatchObject({
      peer: { peerId: bobId, muted: true },
    });

    await bob.emit(ClientEvents.VoiceLeave);
    expect(await waitFor(() => alice.left[0], 'alice to hear bob left')).toEqual({
      roomId: room.id,
      peerId: bobId,
    });

    carol.socket.disconnect();
    expect(await waitFor(() => alice.left[1], 'alice to hear carol dropped')).toEqual({
      roomId: room.id,
      peerId: carolId,
    });

    // Whoever joins now finds only alice.
    const dave = await createClient('LeaveDave');
    await dave.api('POST', `/rooms/${room.id}/join`);
    const joined = await join(dave, room.id);
    if (!joined.ok) throw new Error('dave was refused');
    expect(joined.data.peers.map((peer) => peer.peerId)).toEqual([alice.socket.id]);
  });

  it('takes someone out of the call when they leave the room', async () => {
    const [alice, bob] = [await createClient('RoomAlice'), await createClient('RoomBob')];
    const room = await roomOf(alice, bob);
    for (const client of [alice, bob]) expect((await join(client, room.id)).ok).toBe(true);
    const bobId = bob.socket.id;

    await bob.api('POST', `/rooms/${room.id}/leave`);
    expect(await waitFor(() => alice.left[0], 'alice to hear bob is out')).toEqual({
      roomId: room.id,
      peerId: bobId,
    });
    // He is told too, so his browser lets go of the microphone.
    expect(await waitFor(() => bob.left[0], 'bob to be told he is out')).toEqual({
      roomId: room.id,
      peerId: bobId,
    });
    expect(
      await bob.emit(ClientEvents.VoiceSignal, {
        roomId: room.id,
        toPeerId: alice.socket.id,
        signal: OFFER,
      }),
    ).toMatchObject({ ok: false, error: { code: ErrorCodes.NotInVoice } });
  });
});
