/**
 * BPP Fastify app — Beckn callback routes + the grant-gated download endpoint.
 *
 * Dependencies are injected (catalog, stores, callback dispatcher, clock) so the
 * whole app can be exercised via fastify.inject() with in-memory stores and a
 * recording dispatcher — no DB, no network, fully deterministic tests.
 */
import { createReadStream } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import { BecknContext, ack } from '@bdc/beckn-schemas';
import type { BppConfig } from './config.js';
import type { BppCatalog } from './catalog.js';
import type { RedemptionStore, RevocationStore } from './stores/types.js';
import {
  buildOnConfirm,
  buildOnDiscover,
  buildOnInit,
  buildOnSelect,
  type BuildDeps,
} from './beckn/builders.js';
import { parsePresentedGrant, redeemGrant } from './download.js';

/** Delivers an async `on_<action>` callback to the caller's callback endpoint. */
export type CallbackDispatcher = (url: string, payload: unknown) => Promise<void>;

export interface AppDeps {
  config: BppConfig;
  catalog: BppCatalog;
  revocations: RevocationStore;
  redemptions: RedemptionStore;
  /** Defaults to an HTTP POST via fetch. */
  dispatch?: CallbackDispatcher;
  /** Injectable clock (defaults to real time). */
  now?: () => Date;
  /** Fastify logger option (defaults to true; pass false to quiet tests). */
  logger?: boolean;
}

const httpDispatch: CallbackDispatcher = async (url, payload) => {
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

type Builder = (
  req: BecknContext,
  catalog: BppCatalog,
  message: unknown,
  deps: BuildDeps,
) => { context: Record<string, unknown>; message: Record<string, unknown> };

export function createApp(deps: AppDeps): FastifyInstance {
  const { config, catalog, revocations, redemptions } = deps;
  const dispatch = deps.dispatch ?? httpDispatch;
  const now = deps.now ?? (() => new Date());

  const app = Fastify({ logger: deps.logger ?? true });

  app.get('/health', async () => ({
    status: 'ok',
    service: config.serviceName,
    bppId: config.bppId,
    timestamp: now().toISOString(),
  }));

  // --- Beckn async request routes: synchronous ACK, then fire the on_<action> ---
  const becknRoute = (action: string, build: Builder) =>
    app.post(`/${action}`, async (request, reply) => {
      const body = (request.body ?? {}) as { context?: unknown; message?: unknown };
      const parsed = BecknContext.safeParse(body.context);
      if (!parsed.success) {
        reply.code(400);
        return {
          message: { status: 'NACK' },
          error: { code: 'INVALID_CONTEXT', message: parsed.error.message },
        };
      }
      const ctx = parsed.data;
      const buildDeps: BuildDeps = {
        responder: { bppId: config.bppId, bppUri: config.bppUri },
        nowIso: now().toISOString(),
      };
      const response = build(ctx, catalog, body.message, buildDeps);
      const callbackUrl = `${ctx.bapUri.replace(/\/$/, '')}/${String(response.context.action)}`;
      // Fire-and-forget: the real result is delivered asynchronously to the BAP.
      void dispatch(callbackUrl, response).catch((err) =>
        app.log.error({ err, callbackUrl }, 'callback dispatch failed'),
      );
      reply.code(200);
      return ack(ctx.messageId);
    });

  becknRoute('discover', buildOnDiscover);
  becknRoute('select', buildOnSelect);
  becknRoute('init', buildOnInit);
  becknRoute('confirm', buildOnConfirm);

  // --- The grant-gated download endpoint ---
  app.get('/download', async (request, reply) => {
    const grant = parsePresentedGrant(request.headers.authorization);
    if (grant === undefined) {
      reply.code(401);
      return {
        error: 'grant-required',
        detail: 'present a grant via Authorization: Grant <base64url>',
      };
    }
    const q = request.query as { resourceId?: string; offerId?: string; fields?: string };
    if (!q.resourceId) {
      reply.code(400);
      return { error: 'bad-request', detail: 'resourceId query param is required' };
    }
    const requested = {
      resourceId: q.resourceId,
      offerId: q.offerId,
      fields: q.fields
        ? q.fields
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    };
    const nowDate = now();
    const result = await redeemGrant({
      signedGrant: grant,
      requested,
      bppId: config.bppId,
      accessManagerPublicKey: config.accessManagerPublicKey,
      nowSeconds: Math.floor(nowDate.getTime() / 1000),
      clockSkewSeconds: config.clockSkewSeconds,
      revocations,
      redemptions,
      resolveFile: catalog.resolveFile,
    });

    if (!result.ok) {
      reply.code(result.status);
      return { error: result.reason, detail: result.detail };
    }

    reply.header('content-type', result.file.contentType);
    reply.header('content-disposition', `attachment; filename="${result.file.filename}"`);
    reply.header('x-bdc-grant-id', result.claims.grantId);
    reply.header('x-bdc-redemption-count', String(result.redemptionCount));
    return reply.send(createReadStream(result.file.path));
  });

  return app;
}
