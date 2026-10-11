/**
 * Asks the other side to stop sending while its speaker is silent (Opus "discontinuous
 * transmission"). In a call most people are quiet most of the time, and without this each of
 * them still uploads a steady stream of encoded silence to every other.
 *
 * A session description says what its sender is willing to receive, so this goes on the copy
 * sent to the peer, not on the one the browser keeps. One that does not know the parameter
 * ignores it.
 */
export function askForSilenceSuppression(sdp: string): string {
  const opus = new Set<string>();
  for (const match of sdp.matchAll(/^a=rtpmap:(\d+) opus\//gim)) opus.add(match[1] as string);
  if (opus.size === 0) return sdp;

  const described = new Set<string>();
  const lines = sdp.split(/\r?\n/).map((line) => {
    const fmtp = /^a=fmtp:(\d+) (.*)$/.exec(line);
    if (!fmtp || !opus.has(fmtp[1] as string)) return line;
    described.add(fmtp[1] as string);
    return /(^|;)\s*usedtx=/.test(fmtp[2] as string) ? line : `${line};usedtx=1`;
  });
  // Opus offered with no parameters at all: give it the one.
  const withMissing = lines.flatMap((line) => {
    const rtpmap = /^a=rtpmap:(\d+) opus\//i.exec(line);
    return rtpmap && !described.has(rtpmap[1] as string)
      ? [line, `a=fmtp:${rtpmap[1]} usedtx=1`]
      : [line];
  });
  return withMissing.join(sdp.includes('\r\n') ? '\r\n' : '\n');
}
