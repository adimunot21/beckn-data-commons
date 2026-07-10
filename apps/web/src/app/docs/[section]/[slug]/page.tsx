import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PageShell } from '@/components/site';
import { GITHUB_URL } from '@/lib/brand';
import { listDocs, readDoc, resolveDocHref, type Section } from '@/lib/docs';

interface Params {
  section: string;
  slug: string;
}

function asSection(value: string): Section | undefined {
  return value === 'course' || value === 'tech' ? value : undefined;
}

export function generateStaticParams(): Params[] {
  return (['course', 'tech'] as const).flatMap((section) =>
    listDocs(section).map((doc) => ({ section, slug: doc.slug })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { section, slug } = await params;
  const sec = asSection(section);
  const entry = sec ? listDocs(sec).find((d) => d.slug === slug) : undefined;
  return { title: entry?.title ?? 'Docs' };
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { section, slug } = await params;
  const sec = asSection(section);
  if (!sec) notFound();
  const content = readDoc(sec, slug);
  if (!content) notFound();

  return (
    <PageShell>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/docs" className="text-ink-500 hover:text-ink-300 text-sm">
          ← All docs
        </Link>
        <article className="prose prose-invert prose-headings:tracking-tight prose-a:text-grant-400 prose-code:text-ink-100 mt-6 max-w-none">
          <Markdown
            remarkPlugins={[remarkGfm]}
            urlTransform={(url) => resolveDocHref(sec, url, GITHUB_URL)}
          >
            {content}
          </Markdown>
        </article>
      </main>
    </PageShell>
  );
}
