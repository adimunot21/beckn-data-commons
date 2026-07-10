'use client';

/**
 * Console · My grants — the Access Manager's records for this sandbox identity,
 * merged with the signed grants held in this browser (needed to download).
 * One-click revoke; watch status flip and downloads start failing.
 */
import { useCallback, useEffect, useState } from 'react';
import { GrantCard } from '@/components/grant-card';
import { getGranteeId, listHeldGrants, type HeldGrant } from '@/lib/identity';

interface AmRecord {
  grantId: string;
  status: string;
  resourceId?: string;
  expiresAt?: number;
}

interface DownloadOutcome {
  ok: boolean;
  httpStatus: number;
  error?: string;
  filename?: string;
  bytes?: number;
  preview?: string;
}

export default function GrantsPage() {
  const [records, setRecords] = useState<AmRecord[]>([]);
  const [held, setHeld] = useState<HeldGrant[]>([]);
  const [open, setOpen] = useState<string | undefined>();
  const [downloads, setDownloads] = useState<Record<string, DownloadOutcome>>({});
  const [busy, setBusy] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setHeld(listHeldGrants());
    const res = await fetch(`/api/grants?grantee=${encodeURIComponent(getGranteeId())}`);
    const json = (await res.json().catch(() => ({ grants: [] }))) as { grants?: AmRecord[] };
    setRecords(json.grants ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revoke = useCallback(
    async (grantId: string) => {
      setBusy(`revoke:${grantId}`);
      await fetch(`/api/grants/${grantId}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'revoked from console' }),
      });
      await refresh();
      setBusy(undefined);
    },
    [refresh],
  );

  const download = useCallback(async (heldGrant: HeldGrant) => {
    const id = heldGrant.grant.claims.grantId;
    setBusy(`download:${id}`);
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant: heldGrant.grant, accessUrl: heldGrant.accessUrl }),
    });
    const json = (await res.json().catch(() => ({}))) as DownloadOutcome;
    setDownloads((prev) => ({ ...prev, [id]: json }));
    setBusy(undefined);
  }, []);

  const heldById = new Map(held.map((h) => [h.grant.claims.grantId, h]));
  // AM records are the source of truth for status; held grants fill in the artifact.
  const rows = records.map((record) => ({ record, held: heldById.get(record.grantId) }));

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">My grants</h1>
      <p className="text-ink-300 mt-2 text-sm">
        Status comes from the Access Manager (the consent authority). The signed artifacts
        themselves are held in this browser — presenting one is how you download.
      </p>

      {rows.length === 0 && (
        <p className="text-ink-500 mt-8 text-sm">
          No grants yet — request access to something in the{' '}
          <a href="/console/catalog" className="underline">
            catalog
          </a>
          .
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {rows.map(({ record, held: heldGrant }) => {
          const revoked = record.status === 'REVOKED';
          const outcome = downloads[record.grantId];
          return (
            <li key={record.grantId} className="border-ink-800 bg-ink-900 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {heldGrant?.name ?? record.resourceId ?? record.grantId}
                  </p>
                  <p className="text-ink-500 mt-0.5 font-mono text-xs">{record.grantId}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    revoked
                      ? 'border-revoke-500/50 text-revoke-400'
                      : record.status === 'ISSUED'
                        ? 'border-grant-500/50 text-grant-400'
                        : 'border-ink-700 text-ink-300'
                  }`}
                >
                  {record.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {heldGrant && (
                  <button
                    onClick={() => void download(heldGrant)}
                    disabled={busy === `download:${record.grantId}`}
                    className="border-ink-700 hover:border-ink-500 rounded-md border px-3 py-1.5 disabled:opacity-50"
                  >
                    {busy === `download:${record.grantId}` ? 'Downloading…' : 'Download'}
                  </button>
                )}
                {!revoked && (
                  <button
                    onClick={() => void revoke(record.grantId)}
                    disabled={busy === `revoke:${record.grantId}`}
                    className="border-revoke-500/50 text-revoke-400 hover:bg-revoke-500/10 rounded-md border px-3 py-1.5 disabled:opacity-50"
                  >
                    {busy === `revoke:${record.grantId}` ? 'Revoking…' : 'Revoke'}
                  </button>
                )}
                {heldGrant && (
                  <button
                    onClick={() => setOpen(open === record.grantId ? undefined : record.grantId)}
                    className="text-ink-500 hover:text-ink-300 px-2 py-1.5"
                  >
                    {open === record.grantId ? 'Hide artifact' : 'View artifact'}
                  </button>
                )}
              </div>

              {outcome && (
                <div
                  className={`mt-3 rounded-md border p-3 font-mono text-xs ${
                    outcome.ok
                      ? 'border-grant-500/40 text-grant-400'
                      : 'border-revoke-500/50 text-revoke-400'
                  }`}
                >
                  {outcome.ok
                    ? `HTTP ${outcome.httpStatus} · ${outcome.filename} · ${outcome.bytes} bytes`
                    : `HTTP ${outcome.httpStatus} — ${outcome.error}`}
                  {outcome.ok && outcome.preview && (
                    <pre className="text-ink-300 mt-2 overflow-x-auto">{outcome.preview}</pre>
                  )}
                </div>
              )}

              {open === record.grantId && heldGrant && (
                <div className="mt-4">
                  <GrantCard grant={heldGrant.grant} revoked={revoked} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
