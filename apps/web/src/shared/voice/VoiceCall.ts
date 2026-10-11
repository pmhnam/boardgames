import {
  ClientEvents,
  ServerEvents,
  type Ack,
  type ApiError,
  type VoiceIceServer,
  type VoiceJoined,
  type VoicePeer,
  type VoicePeerLeftMessage,
  type VoicePeerMessage,
  type VoiceSignal,
  type VoiceSignalMessage,
} from '@bgp/shared-types';
import type { Socket } from 'socket.io-client';
import { askForSilenceSuppression } from './sdp';

/** How a connection to one other person in the call stands. */
export type PeerLink = 'connecting' | 'connected' | 'failed';

export interface CallPeer extends VoicePeer {
  link: PeerLink;
  speaking: boolean;
  /** What they are saying, once it arrives: something to play. */
  stream: MediaStream | null;
}

/** Why a call could not be joined, when the reason is on this side of the connection. */
export type VoiceProblem = 'unsupported' | 'mic-denied' | 'mic-missing' | 'mic-failed';

export interface CallState {
  roomId: string;
  status: 'joining' | 'joined';
  muted: boolean;
  /** The viewer's own voice is heard by the microphone right now. */
  speaking: boolean;
  peers: CallPeer[];
}

export type CallEnd =
  | { reason: 'left' }
  | { reason: 'removed' }
  | { reason: 'problem'; problem: VoiceProblem }
  | { reason: 'refused'; error: ApiError };

interface Link {
  connection: RTCPeerConnection;
  /** Candidates that came before the description they belong to. */
  waiting: RTCIceCandidateInit[];
  /** This side opened the connection, so this side is the one to mend it. */
  initiator: boolean;
  restarts: number;
}

const MAX_RESTARTS = 3;
/** How loud a voice has to be to count, on a scale where 1 is as loud as it gets. */
const SPEAKING_LEVEL = 0.035;
const LOUDNESS_EVERY_MS = 150;
/** A voice stays "speaking" for this long after it last was, so a pause does not flicker. */
const SPEAKING_HOLD_MS = 450;

export function voiceSupported(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined
  );
}

/**
 * Speech is clear well below what a browser sends by default, and in a call of eight each phone
 * uploads its voice seven times over.
 */
const VOICE_BITS_PER_SECOND = 24_000;

function capBitrate(sender: RTCRtpSender): void {
  try {
    const parameters = sender.getParameters();
    // Empty until the connection is negotiated in some browsers; one encoding is what audio has.
    if (!parameters.encodings?.length) parameters.encodings = [{}];
    for (const encoding of parameters.encodings) encoding.maxBitrate = VOICE_BITS_PER_SECOND;
    void sender.setParameters(parameters).catch(() => undefined);
  } catch {
    // Uncapped: the call still works, it only costs more data.
  }
}

/** A name for this browser's part in a call, kept for as long as the call lasts. */
function newPeerId(): string {
  // Only missing on a page not served securely, where a microphone cannot be had anyway.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function micProblem(error: unknown): VoiceProblem {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'mic-denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'mic-missing';
  return 'mic-failed';
}

/**
 * One person's part in a room's call. Everyone in a call is connected to everyone else: the
 * sound goes straight from browser to browser, and the server only passes on what two of them
 * need to tell each other to open that connection.
 *
 * Whoever joins opens the connection to each person already there, so two sides never both
 * try. The one who opened a connection is also the one who mends it when it fails.
 *
 * The call is joined under a name of this browser's own choosing, not the socket's. A phone
 * loses its connection to the server for a moment all the time, while the sound, which never
 * went that way, carries on: coming back under the same name, the connections to the others
 * are kept as they are.
 */
export class VoiceCall {
  private readonly peerId = newPeerId();
  private microphone: MediaStream | null = null;
  private iceServers: VoiceIceServer[] = [];
  private readonly links = new Map<string, Link>();
  private state: CallState;
  private closed = false;
  private audio: AudioContext | null = null;
  private readonly meters = new Map<
    string,
    { analyser: AnalyserNode; source: AudioNode; samples: Uint8Array<ArrayBuffer> }
  >();
  private readonly lastHeard = new Map<string, number>();
  private loudnessTimer: number | undefined;

  constructor(
    private readonly socket: Socket,
    roomId: string,
    private readonly onState: (state: CallState) => void,
    private readonly onEnd: (end: CallEnd) => void,
  ) {
    this.state = { roomId, status: 'joining', muted: false, speaking: false, peers: [] };
  }

  /** Asks for the microphone, then for a place in the call. */
  async start(): Promise<void> {
    this.publish();
    if (!voiceSupported()) return this.end({ reason: 'problem', problem: 'unsupported' });
    try {
      this.microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (error) {
      return this.end({ reason: 'problem', problem: micProblem(error) });
    }
    // Left while the browser was still asking about the microphone.
    if (this.closed) return this.release();

    this.socket.on(ServerEvents.VoicePeerJoined, this.onPeerJoined);
    this.socket.on(ServerEvents.VoicePeerLeft, this.onPeerLeft);
    this.socket.on(ServerEvents.VoicePeerMuted, this.onPeerMuted);
    this.socket.on(ServerEvents.VoiceSignal, this.onSignal);
    this.socket.on('connect', this.onReconnect);
    this.startMeters();
    await this.enter();
  }

  setMuted(muted: boolean): void {
    if (this.closed) return;
    for (const track of this.microphone?.getAudioTracks() ?? []) track.enabled = !muted;
    this.update({ muted, speaking: muted ? false : this.state.speaking });
    if (this.state.status === 'joined') {
      void this.socket.emitWithAck(ClientEvents.VoiceMute, { roomId: this.state.roomId, muted });
    }
  }

  leave(): void {
    if (this.closed) return;
    if (this.socket.connected) void this.socket.emitWithAck(ClientEvents.VoiceLeave);
    this.end({ reason: 'left' });
  }

  /**
   * Takes a place in the call, or takes it back after the connection to the server dropped,
   * and opens a connection to everyone it does not have one with.
   */
  private async enter(): Promise<void> {
    const ack: Ack<VoiceJoined> = await this.socket.emitWithAck(ClientEvents.VoiceJoin, {
      roomId: this.state.roomId,
      peerId: this.peerId,
    });
    if (this.closed) return;
    if (!ack.ok) return this.end({ reason: 'refused', error: ack.error });

    this.iceServers = ack.data.iceServers;
    // The place was given up while this side was away: the others have let go of their ends.
    if (!ack.data.resumed) this.dropLinks();
    const present = new Set(ack.data.peers.map((peer) => peer.peerId));
    for (const peerId of [...this.links.keys()]) if (!present.has(peerId)) this.dropLink(peerId);

    const known = new Map(this.state.peers.map((peer) => [peer.peerId, peer]));
    this.update({
      status: 'joined',
      peers: ack.data.peers.map((peer) => {
        const before = this.links.has(peer.peerId) ? known.get(peer.peerId) : undefined;
        return before
          ? { ...before, ...peer }
          : { ...peer, link: 'connecting', speaking: false, stream: null };
      }),
    });
    if (this.state.muted) {
      void this.socket.emitWithAck(ClientEvents.VoiceMute, {
        roomId: this.state.roomId,
        muted: true,
      });
    }
    for (const peer of ack.data.peers) {
      const link = this.links.get(peer.peerId);
      // Someone who joined while this side was away offered into the void: offer to them.
      if (!link) void this.offerTo(peer.peerId);
      else this.mend(peer.peerId, link);
    }
  }

  /**
   * Looks for a way through again on a connection that has lost its own. What either side
   * said to that end while the other was away from the server was never passed on.
   */
  private mend(peerId: string, link: Link): void {
    const { connectionState, signalingState } = link.connection;
    // An offer still waiting for its answer may be one of the things that were never passed on.
    if (link.initiator && signalingState === 'have-local-offer') return void this.offerTo(peerId);
    if (connectionState !== 'failed' && connectionState !== 'disconnected') return;
    if (link.initiator) {
      link.restarts = 0;
      void this.offerTo(peerId, true);
    } else if (connectionState === 'failed') {
      // Not this side's to mend, and the side whose it is may have given up: start over.
      this.dropLink(peerId);
      this.patchPeer(peerId, { link: 'connecting', stream: null });
      void this.offerTo(peerId);
    }
  }

  // Back on the server under a new socket, but under the same name in the call.
  private readonly onReconnect = () => {
    if (this.closed) return;
    void this.enter();
  };

  private readonly onPeerJoined = (message: VoicePeerMessage) => {
    if (this.closed || message.roomId !== this.state.roomId) return;
    if (this.state.peers.some((peer) => peer.peerId === message.peer.peerId)) {
      // Already here: they are back from losing the server, and can hear this side again.
      const link = this.links.get(message.peer.peerId);
      if (link?.initiator) this.mend(message.peer.peerId, link);
      return;
    }
    // They open the connection; this side waits for their offer.
    this.update({
      peers: [
        ...this.state.peers,
        { ...message.peer, link: 'connecting', speaking: false, stream: null },
      ],
    });
  };

  private readonly onPeerLeft = (message: VoicePeerLeftMessage) => {
    if (this.closed || message.roomId !== this.state.roomId) return;
    // The viewer themselves: taken out of the call, because they are no longer in the room.
    if (message.peerId === this.peerId) return this.end({ reason: 'removed' });
    this.dropLink(message.peerId);
    this.update({ peers: this.state.peers.filter((peer) => peer.peerId !== message.peerId) });
  };

  private readonly onPeerMuted = (message: VoicePeerMessage) => {
    if (this.closed || message.roomId !== this.state.roomId) return;
    this.patchPeer(message.peer.peerId, { muted: message.peer.muted });
  };

  private readonly onSignal = (message: VoiceSignalMessage) => {
    if (this.closed || message.roomId !== this.state.roomId) return;
    if (!this.state.peers.some((peer) => peer.peerId === message.fromPeerId)) return;
    void this.receive(message.fromPeerId, message.signal).catch(() => {
      this.patchPeer(message.fromPeerId, { link: 'failed' });
    });
  };

  private async receive(peerId: string, signal: VoiceSignal): Promise<void> {
    if ('description' in signal) {
      const existing = this.links.get(peerId);
      // An offer on a connection this side opened: they have started theirs over, as this side
      // may have too. Either way the old one is done with. So that the two do not both wait for
      // an answer, one of them gives way, always the same one, and the other offers afresh.
      if (signal.description.type === 'offer' && existing?.initiator) {
        this.dropLink(peerId);
        this.patchPeer(peerId, { link: 'connecting', stream: null });
        if (this.peerId > peerId) return void this.offerTo(peerId);
      }
      const link =
        signal.description.type === 'offer'
          ? (this.links.get(peerId) ?? this.open(peerId, false))
          : this.links.get(peerId);
      // An answer to an offer this side has since taken back.
      if (!link || (signal.description.type === 'answer' && !link.initiator)) return;
      await link.connection.setRemoteDescription(signal.description);
      for (const candidate of link.waiting.splice(0)) {
        await link.connection.addIceCandidate(candidate);
      }
      if (signal.description.type === 'offer') {
        await link.connection.setLocalDescription(await link.connection.createAnswer());
        this.send(peerId, { description: this.describe(link.connection) });
      }
      return;
    }

    const link = this.links.get(peerId) ?? this.open(peerId, false);
    if (signal.candidate === null) return;
    if (!link.connection.remoteDescription) link.waiting.push(signal.candidate);
    // One left over from a connection since started over belongs to nothing: no harm in it.
    else await link.connection.addIceCandidate(signal.candidate).catch(() => undefined);
  }

  private async offerTo(peerId: string, restart = false): Promise<void> {
    const link = this.links.get(peerId) ?? this.open(peerId, true);
    try {
      await link.connection.setLocalDescription(
        await link.connection.createOffer({ iceRestart: restart }),
      );
      this.send(peerId, { description: this.describe(link.connection) });
    } catch {
      this.patchPeer(peerId, { link: 'failed' });
    }
  }

  private describe(connection: RTCPeerConnection): { type: 'offer' | 'answer'; sdp: string } {
    const description = connection.localDescription;
    return {
      type: description?.type === 'answer' ? 'answer' : 'offer',
      sdp: askForSilenceSuppression(description?.sdp ?? ''),
    };
  }

  private open(peerId: string, initiator: boolean): Link {
    const connection = new RTCPeerConnection({ iceServers: this.iceServers });
    const link: Link = { connection, waiting: [], initiator, restarts: 0 };
    this.links.set(peerId, link);

    for (const track of this.microphone?.getAudioTracks() ?? []) {
      capBitrate(connection.addTrack(track, this.microphone as MediaStream));
    }
    connection.onicecandidate = ({ candidate }) => {
      this.send(peerId, {
        candidate: candidate && {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
        },
      });
    };
    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.patchPeer(peerId, { stream });
      this.meter(peerId, stream);
    };
    connection.onconnectionstatechange = () => {
      if (this.links.get(peerId) !== link) return;
      const { connectionState } = connection;
      if (connectionState === 'connected') {
        link.restarts = 0;
        this.patchPeer(peerId, { link: 'connected' });
      } else if (connectionState === 'failed') {
        this.patchPeer(peerId, { link: 'failed' });
        // Networks change under a call: ask both ends to look for a way through again.
        if (link.initiator && link.restarts < MAX_RESTARTS) {
          link.restarts += 1;
          void this.offerTo(peerId, true);
        }
      } else if (connectionState === 'connecting' || connectionState === 'new') {
        this.patchPeer(peerId, { link: 'connecting' });
      }
    };
    return link;
  }

  private send(toPeerId: string, signal: VoiceSignal): void {
    if (this.closed || !this.socket.connected) return;
    void this.socket.emitWithAck(ClientEvents.VoiceSignal, {
      roomId: this.state.roomId,
      toPeerId,
      signal,
    });
  }

  // Who is speaking, from how loud each voice is. Shown beside each name, so a call with the
  // microphone muted by mistake, or with nobody coming through, is seen for what it is.

  private startMeters(): void {
    const Context = window.AudioContext;
    if (!Context || !this.microphone) return;
    try {
      this.audio = new Context();
    } catch {
      return;
    }
    this.meter('', this.microphone);
    this.loudnessTimer = window.setInterval(() => this.listen(), LOUDNESS_EVERY_MS);
  }

  private meter(key: string, stream: MediaStream): void {
    if (!this.audio) return;
    this.unmeter(key);
    try {
      const source = this.audio.createMediaStreamSource(stream);
      const analyser = this.audio.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      // One buffer for the life of the meter: it is filled several times a second.
      this.meters.set(key, { analyser, source, samples: new Uint8Array(analyser.fftSize) });
    } catch {
      // No meter for this voice: it is still heard.
    }
  }

  private unmeter(key: string): void {
    this.meters.get(key)?.source.disconnect();
    this.meters.delete(key);
    this.lastHeard.delete(key);
  }

  private listen(): void {
    if (this.closed) return;
    const now = performance.now();
    const speaking = (key: string): boolean => {
      const meter = this.meters.get(key);
      if (!meter) return false;
      const { samples } = meter;
      meter.analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      if (Math.sqrt(sum / samples.length) > SPEAKING_LEVEL) this.lastHeard.set(key, now);
      const heard = this.lastHeard.get(key);
      return heard !== undefined && now - heard < SPEAKING_HOLD_MS;
    };

    const mine = !this.state.muted && speaking('');
    const peers = this.state.peers.map((peer) => {
      const talking = !peer.muted && speaking(peer.peerId);
      return talking === peer.speaking ? peer : { ...peer, speaking: talking };
    });
    const changed =
      mine !== this.state.speaking || peers.some((peer, index) => peer !== this.state.peers[index]);
    if (changed) this.update({ speaking: mine, peers });
  }

  private patchPeer(peerId: string, patch: Partial<CallPeer>): void {
    if (this.closed) return;
    if (!this.state.peers.some((peer) => peer.peerId === peerId)) return;
    this.update({
      peers: this.state.peers.map((peer) =>
        peer.peerId === peerId ? { ...peer, ...patch } : peer,
      ),
    });
  }

  private update(patch: Partial<CallState>): void {
    this.state = { ...this.state, ...patch };
    this.publish();
  }

  private publish(): void {
    if (!this.closed) this.onState(this.state);
  }

  private dropLink(peerId: string): void {
    const link = this.links.get(peerId);
    if (!link) return;
    this.links.delete(peerId);
    link.connection.onicecandidate = null;
    link.connection.ontrack = null;
    link.connection.onconnectionstatechange = null;
    link.connection.close();
    this.unmeter(peerId);
  }

  private dropLinks(): void {
    for (const peerId of [...this.links.keys()]) this.dropLink(peerId);
  }

  private release(): void {
    for (const track of this.microphone?.getTracks() ?? []) track.stop();
    this.microphone = null;
  }

  private end(end: CallEnd): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.off(ServerEvents.VoicePeerJoined, this.onPeerJoined);
    this.socket.off(ServerEvents.VoicePeerLeft, this.onPeerLeft);
    this.socket.off(ServerEvents.VoicePeerMuted, this.onPeerMuted);
    this.socket.off(ServerEvents.VoiceSignal, this.onSignal);
    this.socket.off('connect', this.onReconnect);
    window.clearInterval(this.loudnessTimer);
    this.dropLinks();
    this.unmeter('');
    void this.audio?.close().catch(() => undefined);
    this.audio = null;
    this.release();
    this.onEnd(end);
  }
}
