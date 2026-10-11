import type { GatewayMetadata } from '@nestjs/websockets';

/**
 * Shared by every gateway: they sit on one Socket.IO server, which takes its options from
 * whichever gateway happens to be set up first.
 */
export const GATEWAY_OPTIONS: GatewayMetadata = {
  cors: { origin: true, credentials: true },
  // The web client never long-polls, so nothing else needs to be answered.
  transports: ['websocket'],
  // A game view is a few kilobytes of JSON that shrinks to a fifth; small frames are left alone.
  // No context is kept between messages: that would hold zlib state for every open socket.
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { level: 3 },
    serverNoContextTakeover: true,
    clientNoContextTakeover: true,
  },
  // Nothing a client sends comes near this: actions and call signalling are a few kilobytes.
  maxHttpBufferSize: 64 * 1024,
};
