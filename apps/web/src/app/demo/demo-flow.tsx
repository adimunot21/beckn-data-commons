'use client';

/**
 * The guided sandbox flow: search → confirm (grant issued, decoded on screen) →
 * download 200 → revoke → download 403. Each step calls the app's API routes,
 * which proxy to the real BAP / Access Manager / BPP — nothing is mocked.
 */
import { useCallback, useMemo, useState } from 'react';
import type { SignedAccessGrant } from '@bdc/beckn-schemas';
import { GrantCard } from '@/components/grant-card';
import type { OfferRef } from '@/lib/offers';

type DownloadOutcome = {
  ok: boolean;
  httpStatus: number;
  error?: string;
  filename?: string;
  bytes?: number;
  preview?: string;
};

interface FlowState {
  transactionId?: string;
  offers?: OfferRef[];
  chosen?: OfferRef;
  grant?: SignedAccessGrant;
  accessUrl?: string;
  firstDownload?: DownloadOutcome;
  revoked?: boolean;
  secondDownload?: DownloadOutcome;
  busy?: string;
  error?: string;
}

const PURPOSE = 'train a churn model (sandbox demo)';

function StepHeading({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
          done ? 'border-grant-500 text-grant-400' : 'border-ink-700 text-ink-500'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function Button({
  onClick,
  children,
  busy,
  danger = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`mt-4 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        danger
          ? 'bg-revoke-500 hover:bg-revoke-400 text-white'
          : 'bg-grant-500 hover:bg-grant-400 text-ink-950'
      }`}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <pre className="border-ink-800 bg-ink-900 text-ink-300 mt-3 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  );
}

export function DemoFlow() {
  const [s, setS] = useState<FlowState>({});

  const api = useCallback(async (path: string, body: unknown): Promise<Record<string, unknown>> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok && res.status !== 200) {
      // API routes surface backend refusals inside a 200 for the download step;
      // anything else here is a real failure.
      throw new Error(String(json.detail ?? json.error ?? `HTTP ${res.status}`));
    }
    return json;
  }, []);

  const granteeId = useMemo(() => `demo-${Math.random().toString(36).slice(2, 8)}`, []);

  const run = useCallback((label: string, fn: () => Promise<Partial<FlowState>>) => {
    setS((prev) => ({ ...prev, busy: label, error: undefined }));
    void fn()
      .then((patch) => setS((prev) => ({ ...prev, ...patch, busy: undefined })))
      .catch((err: unknown) =>
        setS((prev) => ({
          ...prev,
          busy: undefined,
          error: err instanceof Error ? err.message : String(err),
        })),
      );
  }, []);

  const doSearch = () =>
    run('search', async () => {
      const json = await api('/api/search', { query: 'churn', purpose: PURPOSE });
      return {
        transactionId: json.transactionId as string,
        offers: json.offers as OfferRef[],
      };
    });

  const doConfirm = (offer: OfferRef) =>
    run('confirm', async () => {
      const json = await api('/api/confirm', {
        transactionId: s.transactionId,
        bppId: offer.bppId,
        bppUri: offer.bppUri,
        offerId: offer.offerId,
        resourceId: offer.resourceId,
        granteeId,
        purpose: PURPOSE,
        licenseClass: offer.licenseClass ?? 'permissive',
      });
      return {
        chosen: offer,
        grant: json.grant as SignedAccessGrant,
        accessUrl: json.accessUrl as string,
      };
    });

  const doDownload = (which: 'firstDownload' | 'secondDownload') =>
    run('download', async () => {
      const json = await api('/api/download', { grant: s.grant, accessUrl: s.accessUrl });
      return { [which]: json as DownloadOutcome };
    });

  const doRevoke = () =>
    run('revoke', async () => {
      await api(`/api/grants/${s.grant?.claims.grantId}/revoke`, {
        reason: 'demo: consent withdrawn',
      });
      return { revoked: true };
    });

  return (
    <div className="mt-10 space-y-10">
      {s.error && (
        <div className="border-revoke-500/50 bg-revoke-500/10 text-revoke-400 rounded-md border p-3 text-sm">
          {s.error} — is the sandbox network up? (<code>docs/DEPLOY.md</code> / <code>infra/</code>)
        </div>
      )}

      {/* Step 1 — search */}
      <section>
        <StepHeading n={1} title="Search the network" done={!!s.offers} />
        <p className="text-ink-300 mt-2 text-sm">
          One request fans out to every provider on the network (a Beckn <code>discover</code>) and
          aggregates their signed replies.
        </p>
        {!s.offers && (
          <Button onClick={doSearch} busy={s.busy === 'search'}>
            Search for “churn”
          </Button>
        )}
        {s.offers && (
          <Mono>
            {`POST /search {"intent":{"query":"churn"}}\n→ ${s.offers.length} offer(s) from ${new Set(s.offers.map((o) => o.bppId)).size} provider(s)\n`}
            {s.offers
              .map((o) => `  • ${o.offerId} — ${o.name} [${o.kind}, ${o.licenseClass}]`)
              .join('\n')}
          </Mono>
        )}
      </section>

      {/* Step 2 — confirm & grant */}
      {s.offers && (
        <section>
          <StepHeading n={2} title="Confirm — and receive a signed Access Grant" done={!!s.grant} />
          <p className="text-ink-300 mt-2 text-sm">
            Confirming runs the Beckn transaction with the provider, then the{' '}
            <strong className="text-ink-100">Access Manager</strong> — a consent authority separate
            from the data holder — signs a grant naming who, what, why, how much, and until when.
          </p>
          {!s.grant &&
            s.offers
              .filter((o) => o.kind === 'dataset')
              .slice(0, 1)
              .map((offer) => (
                <Button
                  key={offer.offerId}
                  onClick={() => doConfirm(offer)}
                  busy={s.busy === 'confirm'}
                >
                  Request access to “{offer.name}”
                </Button>
              ))}
          {s.grant && (
            <div className="mt-4">
              <GrantCard grant={s.grant} revoked={s.revoked} />
              <p className="text-ink-500 mt-2 text-xs">
                This is the actual artifact — decoded from what the Access Manager returned seconds
                ago. Alter one character of the claims and the signature no longer verifies.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Step 3 — download */}
      {s.grant && (
        <section>
          <StepHeading n={3} title="Download by presenting the grant" done={!!s.firstDownload} />
          <p className="text-ink-300 mt-2 text-sm">
            The provider verifies the signature, time window, provider, resource, and scope offline
            — then checks the revocation list — before serving a byte.
          </p>
          {!s.firstDownload && (
            <Button onClick={() => doDownload('firstDownload')} busy={s.busy === 'download'}>
              Download the dataset
            </Button>
          )}
          {s.firstDownload && (
            <Mono>
              {`GET ${s.accessUrl}\nAuthorization: Grant <base64url of the signed grant>\n\n→ HTTP ${s.firstDownload.httpStatus} · ${s.firstDownload.filename ?? 'file'} · ${s.firstDownload.bytes} bytes\n\n${s.firstDownload.preview ?? ''}`}
            </Mono>
          )}
        </section>
      )}

      {/* Step 4 — revoke */}
      {s.firstDownload?.ok && (
        <section>
          <StepHeading n={4} title="Withdraw consent" done={!!s.revoked} />
          <p className="text-ink-300 mt-2 text-sm">
            Revocation happens at the consent authority — not the data holder — and takes effect on
            the very next request, network-wide.
          </p>
          {!s.revoked && (
            <Button danger onClick={doRevoke} busy={s.busy === 'revoke'}>
              Revoke the grant
            </Button>
          )}
          {s.revoked && (
            <Mono>{`POST /grants/${s.grant?.claims.grantId}/revoke\n→ {"status":"REVOKED"}`}</Mono>
          )}
        </section>
      )}

      {/* Step 5 — the refusal */}
      {s.revoked && (
        <section>
          <StepHeading n={5} title="The same download — refused" done={!!s.secondDownload} />
          <p className="text-ink-300 mt-2 text-sm">
            The grant’s signature is still valid. It hasn’t expired. A download link would still
            work. Watch what happens instead:
          </p>
          {!s.secondDownload && (
            <Button onClick={() => doDownload('secondDownload')} busy={s.busy === 'download'}>
              Try the exact same download again
            </Button>
          )}
          {s.secondDownload && (
            <>
              <div className="border-revoke-500/50 bg-revoke-500/10 mt-4 rounded-md border p-4">
                <p className="text-revoke-400 font-mono text-sm font-semibold">
                  HTTP {s.secondDownload.httpStatus} — {s.secondDownload.error}
                </p>
                <p className="text-ink-300 mt-2 text-sm">
                  Consent was withdrawn, so access died — immediately, verifiably, everywhere. This
                  is what an API key or a signed URL can never do.
                </p>
              </div>
              <div className="border-ink-800 bg-ink-900 mt-8 rounded-lg border p-6">
                <h3 className="text-lg font-semibold">That’s the product.</h3>
                <p className="text-ink-300 mt-2 text-sm">
                  Deploy this same gateway in front of <em>your</em> data, and every AI agent gets
                  governed, auditable, revocable access — in an afternoon.
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <a
                    href="/docs"
                    className="border-ink-700 hover:border-ink-500 rounded-md border px-4 py-2"
                  >
                    How it works, from scratch
                  </a>
                  <a
                    href="/#pilot"
                    className="bg-grant-500 hover:bg-grant-400 text-ink-950 rounded-md px-4 py-2 font-medium"
                  >
                    Run a pilot with your data
                  </a>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
