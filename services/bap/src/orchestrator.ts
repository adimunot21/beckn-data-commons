/**
 * BAP orchestration core: fan `discover` out to all BPPs and aggregate their
 * async `on_discover` callbacks within a time window; drive select/init/confirm
 * against a chosen BPP; and, at confirm, ask the Access Manager to issue a grant.
 *
 * Beckn is asynchronous (docs/00_protocol.md §2): a request returns only an ACK,
 * and the real `on_<action>` arrives later on the BAP's callback endpoint. This
 * class registers "pending" collectors keyed by `transactionId:action`; the app's
 * /on_* routes feed callbacks in via deliverCallback(). Correlation is by
 * transactionId; a window bounds how long we wait.
 *
 * Single-instance in-memory aggregation is correct for our topology; a
 * multi-instance BAP would move the pending registry to Redis (same key scheme).
 */
import { randomUUID } from 'node:crypto';
import type { GrantScope, LicenseClass, SignedAccessGrant } from '@bdc/beckn-schemas';
import type { BapConfig, BppEndpoint } from './config.js';
import type { AmClient, BppTransport } from './transport.js';

type Json = Record<string, unknown>;

interface CallbackResponse {
  bppId?: string;
  message: Json;
}

interface Pending {
  expected: number;
  responses: CallbackResponse[];
  finish: () => void;
  timer: NodeJS.Timeout;
}

export interface SearchResult {
  transactionId: string;
  providers: (string | undefined)[];
  catalogs: Json[];
}

export interface ConfirmParams {
  transactionId: string;
  bppId: string;
  bppUri?: string;
  offerId: string;
  resourceId: string;
  grantee: { id: string; publicKey?: string };
  purpose: string;
  licenseClass: LicenseClass;
  scope?: GrantScope;
}

export interface OrchestratorDeps {
  config: BapConfig;
  transport: BppTransport;
  amClient: AmClient;
  now?: () => Date;
  /** Override the aggregation window (tests use a short one). */
  windowMs?: number;
  /** Optional error logger for failed sends. */
  onError?: (err: unknown) => void;
  /** Signs each outbound Beckn envelope as the BAP (per-hop message auth). */
  signOutbound?: (body: unknown) => Promise<string>;
}

export class TimeoutError extends Error {}

export class BapOrchestrator {
  private readonly pending = new Map<string, Pending>();
  private readonly now: () => Date;
  private readonly windowMs: number;

  constructor(private readonly deps: OrchestratorDeps) {
    this.now = deps.now ?? (() => new Date());
    this.windowMs = deps.windowMs ?? deps.config.aggregationWindowMs;
  }

  private key(transactionId: string, action: string): string {
    return `${transactionId}:${action}`;
  }

  private context(action: string, transactionId: string, target?: BppEndpoint): Json {
    return {
      networkId: this.deps.config.networkId,
      action,
      version: '2.0.0',
      bapId: this.deps.config.bapId,
      bapUri: this.deps.config.bapUri,
      ...(target ? { bppId: target.bppId, bppUri: target.uri } : {}),
      transactionId,
      messageId: randomUUID(),
      timestamp: this.now().toISOString(),
      ttl: this.deps.config.messageTtl,
    };
  }

  /** Send `action` to each target and collect up to `expected` callbacks or timeout. */
  private fanOut(
    action: string,
    transactionId: string,
    targets: BppEndpoint[],
    message: Json,
    expected: number,
  ): Promise<CallbackResponse[]> {
    return new Promise((resolve) => {
      const k = this.key(transactionId, action);
      const pending: Pending = {
        expected,
        responses: [],
        finish: () => {
          clearTimeout(pending.timer);
          this.pending.delete(k);
          resolve(pending.responses);
        },
        timer: setTimeout(() => {
          this.pending.delete(k);
          resolve(pending.responses);
        }, this.windowMs),
      };
      this.pending.set(k, pending);

      for (const target of targets) {
        const envelope = { context: this.context(action, transactionId, target), message };
        void (async () => {
          const authorization = this.deps.signOutbound
            ? await this.deps.signOutbound(envelope)
            : undefined;
          await this.deps.transport.send(
            target.uri,
            action,
            envelope,
            authorization ? { authorization } : undefined,
          );
        })().catch((err) => this.deps.onError?.(err));
      }
    });
  }

  /** Feed a BPP callback (on_*) in from the app's callback route. */
  deliverCallback(envelope: unknown): void {
    const env = (envelope ?? {}) as { context?: Json; message?: Json };
    const ctx = env.context ?? {};
    const baseAction = String(ctx.action ?? '').replace(/^on_/, '');
    const transactionId = String(ctx.transactionId ?? '');
    if (!baseAction || !transactionId) return;
    const pending = this.pending.get(this.key(transactionId, baseAction));
    if (!pending) return; // unknown or late callback — ignore
    pending.responses.push({
      bppId: ctx.bppId as string | undefined,
      message: (env.message ?? {}) as Json,
    });
    if (pending.responses.length >= pending.expected) pending.finish();
  }

  async search(intent: Json, purpose?: string): Promise<SearchResult> {
    const transactionId = randomUUID();
    const responses = await this.fanOut(
      'discover',
      transactionId,
      this.deps.config.bpps,
      { intent: { ...intent, ...(purpose ? { purpose } : {}) } },
      this.deps.config.bpps.length,
    );
    return {
      transactionId,
      providers: responses.map((r) => r.bppId),
      catalogs: responses.flatMap((r) => (r.message.catalogs as Json[] | undefined) ?? []),
    };
  }

  private resolveBpp(bppId: string): BppEndpoint {
    const target = this.deps.config.bpps.find((b) => b.bppId === bppId);
    if (!target) throw new Error(`Unknown bppId: ${bppId}`);
    return target;
  }

  private async single(
    action: string,
    transactionId: string,
    bppId: string,
    offerId: string,
  ): Promise<Json> {
    const target = this.resolveBpp(bppId);
    const responses = await this.fanOut(
      action,
      transactionId,
      [target],
      { contract: { offers: [{ id: offerId }] } },
      1,
    );
    if (responses.length === 0) {
      throw new TimeoutError(`No on_${action} from ${bppId} within ${this.windowMs}ms`);
    }
    return (responses[0]!.message.contract as Json | undefined) ?? {};
  }

  select(transactionId: string, bppId: string, offerId: string): Promise<Json> {
    return this.single('select', transactionId, bppId, offerId);
  }

  init(transactionId: string, bppId: string, offerId: string): Promise<Json> {
    return this.single('init', transactionId, bppId, offerId);
  }

  /** Confirm with the BPP, then have the Access Manager issue a scoped grant. */
  async confirm(params: ConfirmParams): Promise<{ contract: Json; grant: SignedAccessGrant }> {
    const target = this.resolveBpp(params.bppId);
    const contract = await this.single(
      'confirm',
      params.transactionId,
      params.bppId,
      params.offerId,
    );
    const grant = await this.deps.amClient.issue({
      grantee: params.grantee,
      provider: { bppId: target.bppId, bppUri: params.bppUri ?? target.uri },
      resource: { resourceId: params.resourceId, offerId: params.offerId },
      scope: params.scope ?? { kind: 'full' },
      licenseClass: params.licenseClass,
      purpose: params.purpose,
      transactionId: params.transactionId,
    });
    return { contract, grant };
  }
}
