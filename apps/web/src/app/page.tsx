import { PRODUCT_NAME } from '@/lib/brand';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
        <p className="text-ink-300 mt-3">
          Governed data access for AI agents. Site under construction.
        </p>
      </div>
    </main>
  );
}
