/**
 * Access Manager HTTP API. Server-to-server surface the BAP calls to issue grants
 * at confirm time, plus revoke/list/status and the public-key endpoint BPPs trust.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { IssueGrantRequest } from '@bdc/beckn-schemas';
import type { VerifyResult } from '@bdc/crypto-utils';
import type { AmConfig } from './config.js';
import type { GrantService } from './service.js';

export interface AmAppDeps {
  config: AmConfig;
  service: GrantService;
  now?: () => Date;
  logger?: boolean;
  /**
   * Authenticates the issue request as coming from the trusted BAP, so no rogue
   * party can mint grants. Production always wires this; unit tests may omit it.
   */
  verifyIssue?: (body: unknown, header: string | undefined) => Promise<VerifyResult>;
}

export function createApp(deps: AmAppDeps): FastifyInstance {
  const { config, service } = deps;
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.logger ?? true, bodyLimit: 256 * 1024 });
  void app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 600),
    timeWindow: '1 minute',
  });

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

  // Issue a grant. Authenticated: only the trusted BAP may request issuance.
  app.post('/grants', async (request, reply) => {
    if (deps.verifyIssue) {
      const auth = await deps.verifyIssue(request.body, request.headers.authorization);
      if (!auth.ok) {
        reply.code(401);
        return { error: 'unauthenticated', reason: auth.reason };
      }
    }
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
