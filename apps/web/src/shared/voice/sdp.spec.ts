import { describe, expect, it } from 'vitest';
import { askForSilenceSuppression } from './sdp';

const sdp = (...lines: string[]) => [...lines, ''].join('\r\n');

describe('asking a peer not to send silence', () => {
  it('adds the request to the Opus line and leaves every other codec alone', () => {
    const offer = sdp(
      'v=0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111 63 9',
      'a=rtpmap:111 opus/48000/2',
      'a=fmtp:111 minptime=10;useinbandfec=1',
      'a=rtpmap:63 red/48000/2',
      'a=fmtp:63 111/111',
      'a=rtpmap:9 G722/8000',
    );
    expect(askForSilenceSuppression(offer)).toBe(
      sdp(
        'v=0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111 63 9',
        'a=rtpmap:111 opus/48000/2',
        'a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1',
        'a=rtpmap:63 red/48000/2',
        'a=fmtp:63 111/111',
        'a=rtpmap:9 G722/8000',
      ),
    );
  });

  it('does not ask twice, nor override a description that already says', () => {
    const asked = sdp('a=rtpmap:109 opus/48000/2', 'a=fmtp:109 maxplaybackrate=48000;usedtx=0');
    expect(askForSilenceSuppression(asked)).toBe(asked);
    const once = askForSilenceSuppression(sdp('a=rtpmap:109 opus/48000/2', 'a=fmtp:109 stereo=1'));
    expect(askForSilenceSuppression(once)).toBe(once);
  });

  it('gives Opus the parameter when it was offered with none', () => {
    expect(askForSilenceSuppression('a=rtpmap:96 opus/48000/2\na=rtpmap:0 PCMU/8000\n')).toBe(
      'a=rtpmap:96 opus/48000/2\na=fmtp:96 usedtx=1\na=rtpmap:0 PCMU/8000\n',
    );
  });

  it('leaves a description without Opus exactly as it was', () => {
    const plain = sdp('v=0', 'a=rtpmap:0 PCMU/8000', 'a=fmtp:0 x=1');
    expect(askForSilenceSuppression(plain)).toBe(plain);
  });
});
