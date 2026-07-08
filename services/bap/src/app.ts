/**
 * BAP HTTP API. Two surfaces:
 *   - client API: /search, /select, /init, /confirm (the flow a UI/MCP drives)
 *   - Beckn callbacks: /on_discover, /on_select, /on_init, /on_confirm (BPP -> BAP)
 * Callbacks are fed into the orchestrator's aggregation window by transactionId.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { LicenseClass, GrantScope } from '@bdc/beckn-schemas';
import type { VerifyResult } from '@bdc/crypto-utils';
import type { BapConfig } from './config.js';
import { type BapOrchestrator, TimeoutError } from './orchestrator.js';

export interface BapAppDeps {
  config: BapConfig;
  orchestrator: BapOrchestrator;
  now?: () => Date;
  logger?: boolean;
  /**
   * Verifies inbound BPP callbacks (on_*). Production always wires this; unit
   * tests that isolate orchestration may omit it. The production entrypoint
   * refuses to boot without message-auth configured — there is no runtime skip.
   */
  verifyCallback?: (body: unknown, header: string | undefined) => Promise<VerifyResult>;
}

type Json = Record<string, unknown>;

export function createApp(deps: BapAppDeps): FastifyInstance {
  const { config, orchestrator } = deps;
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.logger ?? true, bodyLimit: 256 * 1024 });
  void app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 600),
    timeWindow: '1 minute',
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: config.serviceName,
    bapId: config.bapId,
    timestamp: now().toISOString(),
  }));

  // ---- Beckn callback endpoints: receive on_* from BPPs, ACK, feed aggregator ----
  // Every callback is authenticated: a forged or replayed on_* is rejected before
  // it can poison the aggregation window.
  for (const action of ['on_discover', 'on_select', 'on_init', 'on_confirm']) {
    app.post(`/${action}`, async (request, reply) => {
      if (deps.verifyCallback) {
        const result = await deps.verifyCallback(request.body, request.headers.authorization);
        if (!result.ok) {
          reply.code(401);
          return {
            message: { status: 'NACK' },
            error: { code: 'UNAUTHENTICATED', reason: result.reason },
          };
        }
      }
      orchestrator.deliverCallback(request.body);
      return { message: { status: 'ACK' } };
    });
  }

  // ---- Client API ----
  app.post('/search', async (request) => {
    const body = (request.body ?? {}) as { intent?: Json; purpose?: string };
    return orchestrator.search(body.intent ?? {}, body.purpose);
  });

  const contractRoute = (
    action: 'select' | 'init',
    run: (t: string, b: string, o: string) => Promise<Json>,
  ) =>
    app.post(`/${action}`, async (request, reply) => {
      const b = (request.body ?? {}) as {
        transactionId?: string;
        bppId?: string;
        offerId?: string;
      };
      if (!b.transactionId || !b.bppId || !b.offerId) {
        reply.code(400);
        return { error: 'bad-request', detail: 'transactionId, bppId, offerId are required' };
      }
      try {
        return { contract: await run(b.transactionId, b.bppId, b.offerId) };
      } catch (err) {
        return handleErr(reply, err);
      }
    });

  contractRoute('select', (t, b, o) => orchestrator.select(t, b, o));
  contractRoute('init', (t, b, o) => orchestrator.init(t, b, o));

  app.post('/confirm', async (request, reply) => {
    const b = (request.body ?? {}) as Json;
    const licenseClass = LicenseClass.safeParse(b.licenseClass);
    const scope = b.scope !== undefined ? GrantScope.safeParse(b.scope) : undefined;
    const grantee = b.grantee as { id?: string } | undefined;
    if (!b.transactionId || !b.bppId || !b.offerId || !b.resourceId || !b.purpose) {
      reply.code(400);
      return {
        error: 'bad-request',
        detail: 'transactionId, bppId, offerId, resourceId, purpose are required',
      };
    }
    if (!licenseClass.success) {
      reply.code(400);
      return { error: 'bad-request', detail: 'valid licenseClass is required' };
    }
    if (!grantee?.id) {
      reply.code(400);
      return { error: 'bad-request', detail: 'grantee.id is required' };
    }
    if (scope && !scope.success) {
      reply.code(400);
      return { error: 'bad-request', detail: 'invalid scope' };
    }
    try {
      return await orchestrator.confirm({
        transactionId: String(b.transactionId),
        bppId: String(b.bppId),
        bppUri: b.bppUri ? String(b.bppUri) : undefined,
        offerId: String(b.offerId),
        resourceId: String(b.resourceId),
        grantee: { id: grantee.id, publicKey: (grantee as { publicKey?: string }).publicKey },
        purpose: String(b.purpose),
        licenseClass: licenseClass.data,
        scope: scope?.success ? scope.data : undefined,
      });
    } catch (err) {
      return handleErr(reply, err);
    }
  });

  return app;
}

function handleErr(reply: { code: (n: number) => void }, err: unknown): Json {
  if (err instanceof TimeoutError) {
    reply.code(504);
    return { error: 'timeout', detail: err.message };
  }
  if (err instanceof Error && err.message.startsWith('Unknown bppId')) {
    reply.code(400);
    return { error: 'unknown-bpp', detail: err.message };
  }
  reply.code(502);
  return { error: 'upstream-error', detail: err instanceof Error ? err.message : String(err) };
}
