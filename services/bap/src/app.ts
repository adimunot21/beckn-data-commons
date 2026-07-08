/**
 * BAP HTTP API. Two surfaces:
 *   - client API: /search, /select, /init, /confirm (the flow a UI/MCP drives)
 *   - Beckn callbacks: /on_discover, /on_select, /on_init, /on_confirm (BPP -> BAP)
 * Callbacks are fed into the orchestrator's aggregation window by transactionId.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { LicenseClass, GrantScope } from '@bdc/beckn-schemas';
import type { BapConfig } from './config.js';
import { type BapOrchestrator, TimeoutError } from './orchestrator.js';

export interface BapAppDeps {
  config: BapConfig;
  orchestrator: BapOrchestrator;
  now?: () => Date;
  logger?: boolean;
}

type Json = Record<string, unknown>;

export function createApp(deps: BapAppDeps): FastifyInstance {
  const { config, orchestrator } = deps;
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.logger ?? true });

  app.get('/health', async () => ({
    status: 'ok',
    service: config.serviceName,
    bapId: config.bapId,
    timestamp: now().toISOString(),
  }));

  // ---- Beckn callback endpoints: receive on_* from BPPs, ACK, feed aggregator ----
  for (const action of ['on_discover', 'on_select', 'on_init', 'on_confirm']) {
    app.post(`/${action}`, async (request) => {
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
