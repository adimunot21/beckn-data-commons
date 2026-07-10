import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageShell } from '@/components/site';

export const metadata: Metadata = { title: 'Console' };

// Static site (GitHub Pages) has no backend — the console needs the live network.
const RECORDED_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'recorded';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  if (RECORDED_MODE) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">Console needs the live network</h1>
          <p className="text-ink-300 mt-3">
            You’re on the static preview site. The console issues and revokes real grants, so it
            needs a running sandbox network — boot one locally in about 10 minutes with the{' '}
            <Link
              href="/docs/tech/DEPLOY"
              className="text-grant-400 underline-offset-2 hover:underline"
            >
              deploy guide
            </Link>
            , or watch the{' '}
            <Link href="/demo" className="text-grant-400 underline-offset-2 hover:underline">
              recorded demo
            </Link>{' '}
            of the exact same flow.
          </p>
        </div>
      </PageShell>
    );
  }
  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-1 text-sm">
            <Link
              href="/console/catalog"
              className="border-ink-800 hover:border-ink-500 rounded-md border px-3 py-1.5"
            >
              Catalog
            </Link>
            <Link
              href="/console/grants"
              className="border-ink-800 hover:border-ink-500 rounded-md border px-3 py-1.5"
            >
              My grants
            </Link>
          </nav>
          <p className="text-ink-500 text-xs">
            Sandbox identity (this browser) — org accounts &amp; API keys arrive with Wave 2
          </p>
        </div>
        {children}
      </div>
    </PageShell>
  );
}
