import Link from 'next/link';
import { PageShell } from '@/components/site';
import { PRODUCT_NAME } from '@/lib/brand';

const LIFECYCLE = [
  ['discover', 'An agent searches the network; every provider answers with signed catalogs.'],
  ['confirm', 'Terms are agreed; an independent consent authority signs an Access Grant.'],
  [
    'download',
    'The provider verifies the grant — signature, scope, expiry, revocation — then serves.',
  ],
  ['revoke', 'Withdraw consent once; every provider refuses the grant on the very next request.'],
] as const;

const COMPARISON: [string, string, string][] = [
  ['Records who got access, and why', 'no', 'signed into the grant'],
  ['Scoped (sample / specific fields)', 'no', 'full · sample · subset'],
  ['Revocable immediately', 'no — works until expiry', 'yes, at the authority'],
  ['Verifiable by third parties', 'no — opaque token', 'anyone, via public key'],
  ['Issued independently of the data holder', 'no', 'separate consent authority'],
  ['Audit trail', 'server logs, maybe', 'first-class'],
];

export default function Home() {
  return (
    <PageShell>
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6">
          <p className="text-grant-400 font-mono text-sm">
            consent-governed data access · agent-native
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Give AI agents governed access to your data{' '}
            <span className="text-grant-400">in an afternoon.</span>
          </h1>
          <p className="text-ink-300 mt-6 max-w-2xl text-lg">
            {PRODUCT_NAME} is a drop-in gateway that lets agents discover, license, and download
            your data under{' '}
            <strong className="text-ink-100">signed, scoped, revocable access grants</strong> — with
            a full audit trail — instead of API keys and download links.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="bg-grant-500 hover:bg-grant-400 text-ink-950 rounded-md px-5 py-2.5 font-medium"
            >
              Watch a grant get revoked, live →
            </Link>
            <a
              href="#pilot"
              className="border-ink-700 hover:border-ink-500 rounded-md border px-5 py-2.5"
            >
              Run a pilot
            </a>
          </div>
        </section>

        {/* Problem */}
        <section className="border-ink-800 border-y bg-[color:var(--color-ink-900)]/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              Agents are being wired to data with bearer credentials.
            </h2>
            <div className="text-ink-300 mt-6 grid gap-8 sm:grid-cols-3">
              <div>
                <p className="text-ink-100 font-medium">Invisible</p>
                <p className="mt-1 text-sm">
                  An API key in an agent config records nothing — not who is using it, not for what,
                  not under which license.
                </p>
              </div>
              <div>
                <p className="text-ink-100 font-medium">Irrevocable</p>
                <p className="mt-1 text-sm">
                  Once a signed URL leaks — pasted, cached, forwarded — anyone holding it pulls your
                  data until it expires. There is no undo.
                </p>
              </div>
              <div>
                <p className="text-ink-100 font-medium">All-or-nothing</p>
                <p className="mt-1 text-sm">
                  A link can’t say “a sample”, “these three fields”, or “research use only.” So
                  compliance says no — and the deal dies.
                </p>
              </div>
            </div>
            <p className="text-ink-300 mt-8 text-sm">
              That’s why every “let the agent use our data” request stalls. {PRODUCT_NAME} is how
              your data team says <span className="text-grant-400 font-medium">yes</span>.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="text-ink-300 mt-2 max-w-2xl text-sm">
            An open-protocol gateway in front of your data, plus an independent consent authority.
            Four moves:
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-4">
            {LIFECYCLE.map(([step, text], i) => (
              <li key={step} className="border-ink-800 bg-ink-900 rounded-lg border p-4">
                <p className="font-mono text-sm">
                  <span className="text-ink-500">{i + 1} · </span>
                  <span className={step === 'revoke' ? 'text-revoke-400' : 'text-grant-400'}>
                    {step}
                  </span>
                </p>
                <p className="text-ink-300 mt-2 text-sm">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Comparison */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Versus the download link</h2>
          <div className="border-ink-800 mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-900 text-ink-300">
                <tr>
                  <th className="px-4 py-3 font-medium"> </th>
                  <th className="px-4 py-3 font-medium">API key / signed URL</th>
                  <th className="text-grant-400 px-4 py-3 font-medium">Access Grant</th>
                </tr>
              </thead>
              <tbody className="divide-ink-800 divide-y">
                {COMPARISON.map(([what, them, us]) => (
                  <tr key={what}>
                    <td className="text-ink-100 px-4 py-3">{what}</td>
                    <td className="text-ink-500 px-4 py-3">{them}</td>
                    <td className="text-grant-400 px-4 py-3">{us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pilot CTA */}
        <section id="pilot" className="border-ink-800 border-t bg-[color:var(--color-ink-900)]/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Design-partner pilots — free</h2>
            <p className="text-ink-300 mt-3 max-w-2xl">
              We’re onboarding 2–3 design partners: your data behind a private gateway, governed
              agent access with a full audit trail, weekly iteration with the team building it.
              60–90 days, no fee, a short mutual pilot agreement.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="mailto:adimunot21@gmail.com?subject=Pilot%20inquiry"
                className="bg-grant-500 hover:bg-grant-400 text-ink-950 rounded-md px-5 py-2.5 font-medium"
              >
                Talk to us about a pilot
              </a>
              <Link
                href="/docs"
                className="border-ink-700 hover:border-ink-500 rounded-md border px-5 py-2.5"
              >
                Read how the whole thing works
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
