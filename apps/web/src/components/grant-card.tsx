import type { SignedAccessGrant } from '@bdc/beckn-schemas';

function ts(unixSeconds: number): string {
  return new Date(unixSeconds * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z/, ' UTC');
}

/**
 * The decoded Access Grant — the product's visual signature. Shows the consent
 * artifact's claims (who/what/why/how much/until when/revocable) and the Ed25519
 * signature that makes it unforgeable.
 */
export function GrantCard({
  grant,
  revoked = false,
}: {
  grant: SignedAccessGrant;
  revoked?: boolean;
}) {
  const c = grant.claims;
  const rows: [string, string][] = [
    ['grantee (who)', c.grantee.id],
    ['resource (what)', `${c.resource.resourceId} · offer ${c.resource.offerId ?? '—'}`],
    ['provider', c.provider.bppId],
    ['purpose (why)', c.purpose],
    [
      'scope (how much)',
      c.scope.kind +
        ('fields' in c.scope && c.scope.fields ? `: ${c.scope.fields.join(', ')}` : ''),
    ],
    ['license', c.licenseClass],
    ['valid', `${ts(c.notBefore)} → ${ts(c.expiresAt)}`],
    ['revocable', c.revocable ? 'yes' : 'no'],
    ['issuer', c.issuer],
  ];
  return (
    <div
      className={`rounded-lg border ${revoked ? 'border-revoke-500/50' : 'border-grant-500/40'} bg-ink-900 overflow-hidden`}
    >
      <div
        className={`flex items-center justify-between px-4 py-2 text-xs font-medium uppercase tracking-wider ${
          revoked ? 'bg-revoke-500/10 text-revoke-400' : 'bg-grant-500/10 text-grant-400'
        }`}
      >
        <span>Access Grant · {grant.claims.v}</span>
        <span>{revoked ? 'REVOKED' : 'SIGNED'}</span>
      </div>
      <dl className="divide-ink-800 divide-y text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-2">
            <dt className="text-ink-500 w-36 shrink-0">{label}</dt>
            <dd className="text-ink-100 break-all font-mono text-[13px]">{value}</dd>
          </div>
        ))}
        <div className="flex gap-4 px-4 py-2">
          <dt className="text-ink-500 w-36 shrink-0">grantId</dt>
          <dd className="text-ink-300 break-all font-mono text-[13px]">{c.grantId}</dd>
        </div>
        <div className="flex gap-4 px-4 py-2">
          <dt className="text-ink-500 w-36 shrink-0">ed25519 signature</dt>
          <dd
            className={`break-all font-mono text-[13px] ${revoked ? 'text-revoke-400/70' : 'text-grant-400'}`}
          >
            {grant.signature}
          </dd>
        </div>
      </dl>
    </div>
  );
}
