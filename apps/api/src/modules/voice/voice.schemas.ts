import { z } from 'zod';

/** Transport-level shapes only. What a signal says is between the two browsers. */
export const voiceRoomSchema = z.object({
  roomId: z.uuid(),
  /** The browser's own name for its part in the call. Older clients send none. */
  peerId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/)
    .optional(),
});

export const voiceMuteSchema = z.object({ roomId: z.uuid(), muted: z.boolean() });

/** Generous for one audio line, and far short of anything worth flooding a connection with. */
const MAX_SDP_LENGTH = 20_000;
const MAX_CANDIDATE_LENGTH = 2_000;

const candidateSchema = z.object({
  candidate: z.string().max(MAX_CANDIDATE_LENGTH),
  sdpMid: z.string().max(64).nullable(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullable(),
  usernameFragment: z.string().max(256).nullable().optional(),
});

export const voiceSignalSchema = z.object({
  roomId: z.uuid(),
  toPeerId: z.string().min(1).max(64),
  signal: z.union([
    z.strictObject({
      description: z.strictObject({
        type: z.enum(['offer', 'answer']),
        sdp: z.string().min(1).max(MAX_SDP_LENGTH),
      }),
    }),
    z.strictObject({ candidate: candidateSchema.nullable() }),
  ]),
});
