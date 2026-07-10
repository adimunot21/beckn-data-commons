'use client';

/**
 * Console · Catalog — search the network, request access to an offer. On
 * confirm, the signed grant is stored client-side (see lib/identity.ts) and
 * surfaced under "My grants".
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SignedAccessGrant } from '@bdc/beckn-schemas';
import { addHeldGrant, getGranteeId } from '@/lib/identity';
import type { OfferRef } from '@/lib/offers';

export default function CatalogPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [offers, setOffers] = useState<OfferRef[] | undefined>();
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const doSearch = useCallback(async () => {
    setBusy('search');
    setError(undefined);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const json = (await res.json()) as {
        transactionId?: string;
        offers?: OfferRef[];
        detail?: string;
      };
      if (!res.ok) throw new Error(json.detail ?? 'search failed');
      setOffers(json.offers ?? []);
      setTransactionId(json.transactionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(undefined);
    }
  }, [query]);

  const requestAccess = useCallback(
    async (offer: OfferRef) => {
      const purpose = window.prompt(
        'Stated purpose of access (recorded in the signed grant):',
        'evaluate for a sandbox project',
      );
      if (!purpose) return;
      setBusy(offer.offerId);
      setError(undefined);
      try {
        const res = await fetch('/api/confirm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            transactionId,
            bppId: offer.bppId,
            bppUri: offer.bppUri,
            offerId: offer.offerId,
            resourceId: offer.resourceId,
            granteeId: getGranteeId(),
            purpose,
            licenseClass: offer.licenseClass ?? 'permissive',
          }),
        });
        const json = (await res.json()) as {
          grant?: SignedAccessGrant;
          accessUrl?: string;
          detail?: string;
        };
        if (!res.ok || !json.grant || !json.accessUrl)
          throw new Error(json.detail ?? 'confirm failed');
        addHeldGrant({
          grant: json.grant,
          accessUrl: json.accessUrl,
          name: offer.name,
          obtainedAt: new Date().toISOString(),
        });
        router.push('/console/grants');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(undefined);
      }
    },
    [router, transactionId],
  );

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
      <p className="text-ink-300 mt-2 text-sm">
        Search every provider on the sandbox network at once. Requesting access issues a real signed
        Access Grant to your sandbox identity.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
          placeholder='Try "churn", "image", or leave empty for everything'
          className="border-ink-700 bg-ink-900 placeholder:text-ink-500 w-full max-w-md rounded-md border px-3 py-2 text-sm outline-none focus:border-[color:var(--color-grant-500)]"
        />
        <button
          onClick={() => void doSearch()}
          disabled={busy === 'search'}
          className="bg-grant-500 hover:bg-grant-400 text-ink-950 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === 'search' ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <p className="text-revoke-400 mt-4 text-sm">{error} — is the sandbox network running?</p>
      )}

      {offers && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {offers.length === 0 && <p className="text-ink-500 text-sm">No matching resources.</p>}
          {offers.map((offer) => (
            <li key={offer.offerId} className="border-ink-800 bg-ink-900 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{offer.name}</p>
                  <p className="text-ink-500 mt-0.5 font-mono text-xs">{offer.offerId}</p>
                </div>
                <span className="border-ink-700 text-ink-300 rounded-full border px-2 py-0.5 text-xs">
                  {offer.kind}
                </span>
              </div>
              {offer.description && (
                <p className="text-ink-300 mt-2 text-sm">{offer.description}</p>
              )}
              <p className="text-ink-500 mt-2 text-xs">
                {[
                  offer.modality,
                  offer.taskType,
                  offer.rowCount !== undefined ? `${offer.rowCount} rows` : undefined,
                  offer.licenseClass && `license: ${offer.licenseClass}`,
                  `provider: ${offer.bppId}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <button
                onClick={() => void requestAccess(offer)}
                disabled={busy === offer.offerId}
                className="border-grant-500/50 text-grant-400 hover:bg-grant-500/10 mt-4 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {busy === offer.offerId ? 'Issuing grant…' : 'Request access'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
