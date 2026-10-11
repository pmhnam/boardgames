import { describe, expect, it } from 'vitest';
import { VoiceRooms } from './voice-rooms.js';

const peer = (peerId: string, userId = `user-${peerId}`) => ({
  peerId,
  userId,
  displayName: userId,
  muted: false,
});

describe('who is in which call', () => {
  it('tells a joiner who is already there, and not about itself', () => {
    const calls = new VoiceRooms(8);
    expect(calls.join('room', peer('a'))).toEqual([]);
    expect(calls.join('room', peer('b'))).toEqual([peer('a')]);
    expect(calls.peers('room')).toEqual([peer('a'), peer('b')]);
    expect(calls.roomOf('b')).toBe('room');
  });

  it('keeps one room apart from another', () => {
    const calls = new VoiceRooms(8);
    calls.join('one', peer('a'));
    expect(calls.join('two', peer('b'))).toEqual([]);
    expect(calls.has('one', 'b')).toBe(false);
    expect(calls.has('two', 'b')).toBe(true);
  });

  it('turns a joiner away once the call is full, and takes one again when someone leaves', () => {
    const calls = new VoiceRooms(2);
    calls.join('room', peer('a'));
    calls.join('room', peer('b'));
    expect(calls.join('room', peer('c'))).toBe('full');
    expect(calls.roomOf('c')).toBeNull();
    expect(calls.leave('a')).toBe('room');
    expect(calls.join('room', peer('c'))).toEqual([peer('b')]);
  });

  it('forgets a call when the last one in it leaves', () => {
    const calls = new VoiceRooms(8);
    calls.join('room', peer('a'));
    expect(calls.leave('a')).toBe('room');
    expect(calls.peers('room')).toEqual([]);
    expect(calls.leave('a')).toBeNull();
  });

  it('refuses a connection that is still in a call', () => {
    const calls = new VoiceRooms(8);
    calls.join('one', peer('a'));
    expect(() => calls.join('two', peer('a'))).toThrow();
  });

  it('records a muted microphone, and knows nothing of one that is not in a call', () => {
    const calls = new VoiceRooms(8);
    calls.join('room', peer('a'));
    expect(calls.setMuted('a', true)).toEqual({ ...peer('a'), muted: true });
    expect(calls.peers('room')).toEqual([{ ...peer('a'), muted: true }]);
    expect(calls.setMuted('nobody', true)).toBeNull();
  });
});
