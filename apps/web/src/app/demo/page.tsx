import type { Metadata } from 'next';
import { PageShell } from '@/components/site';
import { DemoFlow } from './demo-flow';

export const metadata: Metadata = {
  title: 'Live demo',
  description:
    'Watch a real signed, revocable Access Grant get issued, used to download data, revoked, and refused — live against the sandbox network.',
};

export default function DemoPage() {
  return (
    <PageShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">The whole product in five clicks</h1>
        <p className="text-ink-300 mt-3">
          Everything below runs live against the sandbox network — real services, real cryptography,
          synthetic data. You are about to obtain a{' '}
          <strong className="text-ink-100">signed, scoped, revocable Access Grant</strong>, use it
          to download a dataset, revoke it, and watch the same download get refused.
        </p>
        <DemoFlow />
      </main>
    </PageShell>
  );
}
