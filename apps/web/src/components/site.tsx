import Link from 'next/link';
import type { ReactNode } from 'react';
import { GITHUB_URL, PRODUCT_NAME } from '@/lib/brand';

const NAV = [
  { href: '/demo', label: 'Live demo' },
  { href: '/console/catalog', label: 'Console' },
  { href: '/docs', label: 'Docs' },
];

export function SiteHeader() {
  return (
    <header className="border-ink-800 sticky top-0 z-40 border-b bg-[color:var(--color-ink-950)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-grant-500 inline-block h-2.5 w-2.5 rounded-full" aria-hidden />
          {PRODUCT_NAME}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-300 hover:text-ink-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-ink-300 hover:text-ink-100 transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-ink-800 mt-24 border-t">
      <div className="text-ink-500 mx-auto max-w-6xl space-y-2 px-4 py-10 text-sm sm:px-6">
        <p>
          {PRODUCT_NAME} is open source and in its pilot stage. All data on the public sandbox is{' '}
          <strong className="text-ink-300">synthetic</strong> — no real datasets are listed.
        </p>
        <p>
          Built on the Beckn protocol with a DEPA-inspired consent architecture.{' '}
          <a href={GITHUB_URL} className="text-ink-300 underline-offset-2 hover:underline">
            Source & documentation
          </a>
          .
        </p>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
