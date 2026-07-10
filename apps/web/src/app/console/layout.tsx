import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageShell } from '@/components/site';

export const metadata: Metadata = { title: 'Console' };

export default function ConsoleLayout({ children }: { children: ReactNode }) {
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
