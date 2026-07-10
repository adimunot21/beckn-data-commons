import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/site';
import { listDocs } from '@/lib/docs';

export const metadata: Metadata = {
  title: 'Docs',
  description:
    'From-scratch course on consent-governed agent data access, plus the full technical documentation.',
};

export default function DocsIndex() {
  const course = listDocs('course');
  const tech = listDocs('tech');
  return (
    <PageShell>
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">The course — from absolute zero</h2>
          <p className="text-ink-300 mt-2 text-sm">
            No prerequisites: protocols, DPI, Beckn, consent, cryptography, agents — everything this
            product rests on, explained from scratch, ending in a run-it-yourself capstone.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {course.map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={`/docs/course/${doc.slug}`}
                  className="border-ink-800 bg-ink-900 hover:border-ink-500 block rounded-md border px-3 py-2 text-sm"
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Technical reference</h2>
          <p className="text-ink-300 mt-2 text-sm">
            Architecture, the consent-artifact spec, the threat model, deployment, and per-component
            walkthroughs.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {tech.map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={`/docs/tech/${doc.slug}`}
                  className="border-ink-800 bg-ink-900 hover:border-ink-500 block rounded-md border px-3 py-2 text-sm"
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </PageShell>
  );
}
