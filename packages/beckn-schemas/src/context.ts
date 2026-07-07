/**
 * Beckn v2.0.0 transaction context + envelope + ACK.
 *
 * VERIFIED against real captured payloads (docs/protocol-samples/ddm/, see
 * docs/00_protocol.md). v2 is camelCase and uses `discover`/`on_discover` —
 * this is NOT the snake_case v1 shape the original plan assumed.
 */
import { z } from 'zod';

/** Beckn actions our BDC flow handles (request forms + their callbacks). */
export const BecknAction = z.enum([
  'discover',
  'on_discover',
  'select',
  'on_select',
  'init',
  'on_init',
  'confirm',
  'on_confirm',
]);
export type BecknAction = z.infer<typeof BecknAction>;

/** ISO-8601 duration, e.g. `PT30S`. */
const ISO_DURATION_RE = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;

/**
 * The `context` present on every request and callback. `bppId`/`bppUri` are
 * optional because a broadcast `discover` may omit them (the gateway fans out);
 * callbacks and directed messages carry them. `.passthrough()` keeps unknown
 * fields — real networks add their own.
 */
export const BecknContext = z
  .object({
    networkId: z.string().min(1),
    action: z.string().min(1),
    version: z.string().min(1),
    bapId: z.string().min(1),
    bapUri: z.string().url(),
    bppId: z.string().min(1).optional(),
    bppUri: z.string().url().optional(),
    transactionId: z.string().uuid(),
    messageId: z.string().uuid(),
    timestamp: z.string().datetime({ offset: true }),
    ttl: z.string().regex(ISO_DURATION_RE, 'ttl must be an ISO-8601 duration like PT30S'),
  })
  .passthrough();
export type BecknContext = z.infer<typeof BecknContext>;

/**
 * A Beckn message envelope. Pass the action-specific `message` schema to get a
 * fully-typed envelope, e.g. `becknEnvelope(OnDiscoverMessage)`.
 */
export function becknEnvelope<TMessage extends z.ZodTypeAny>(message: TMessage) {
  return z.object({ context: BecknContext, message });
}

export const AckStatus = z.enum(['ACK', 'NACK']);
export type AckStatus = z.infer<typeof AckStatus>;

/**
 * Synchronous response to any Beckn request — an ACK/NACK, NOT the result. The
 * real `on_<action>` payload arrives later at the caller's callback endpoint.
 */
export const BecknAck = z
  .object({
    message: z.object({
      status: AckStatus,
      messageId: z.string().optional(),
    }),
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
        type: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type BecknAck = z.infer<typeof BecknAck>;

/** Build an ACK for a given context (mirrors the sandbox's ACK shape). */
export function ack(messageId: string): BecknAck {
  return { message: { status: 'ACK', messageId } };
}
