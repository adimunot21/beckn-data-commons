/**
 * Access Manager HTTP API. Server-to-server surface the BAP calls to issue grants
 * at confirm time, plus revoke/list/status and the public-key endpoint BPPs trust.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { IssueGrantRequest } from '@bdc/beckn-schemas';
import type { AmConfig } from './config.js';
import type { GrantService } from './service.js';

export interface AmAppDeps {
  config: AmConfig;
  service: GrantService;
  now?: () => Date;
  logger?: boolean;
}

export function createApp(deps: AmAppDeps): FastifyInstance {
  const { config, service } = deps;
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.logger ?? true });

  app.get('/health', async () => ({
    status: 'ok',
    service: config.serviceName,
    timestamp: now().toISOString(),
  }));

  // The public key BPPs use to verify grant signatures.
  app.get('/pubkey', async () => ({
    amId: config.amId,
    issuerKeyId: config.issuerKeyId,
    alg: 'ed25519',
    publicKey: service.publicKey,
  }));

  // Issue a grant.
  app.post('/grants', async (request, reply) => {
    const parsed = IssueGrantRequest.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid-request', detail: parsed.error.message };
    }
    const nowSeconds = Math.floor(now().getTime() / 1000);
    const signed = await service.issue(parsed.data, nowSeconds);
    reply.code(201);
    return signed;
  });

  // Grant status / record.
  app.get('/grants/:grantId', async (request, reply) => {
    const { grantId } = request.params as { grantId: string };
    const record = await service.get(grantId);
    if (!record) {
      reply.code(404);
      return { error: 'not-found' };
    }
    return record;
  });

  // Grant history for a grantee.
  app.get('/grants', async (request, reply) => {
    const { grantee } = request.query as { grantee?: string };
    if (!grantee) {
      reply.code(400);
      return { error: 'bad-request', detail: 'grantee query param is required' };
    }
    return { grantee, grants: await service.list(grantee) };
  });

  // Revoke a grant (writes the shared revocation table the BPP reads).
  app.post('/grants/:grantId/revoke', async (request, reply) => {
    const { grantId } = request.params as { grantId: string };
    const { reason } = (request.body ?? {}) as { reason?: string };
    const outcome = await service.revoke(grantId, reason ?? 'unspecified');
    if (outcome === 'not-found') {
      reply.code(404);
      return { error: 'not-found' };
    }
    if (outcome === 'already-revoked') {
      reply.code(409);
      return { grantId, status: 'REVOKED', outcome };
    }
    return { grantId, status: 'REVOKED', outcome };
  });

  return app;
}
