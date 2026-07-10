/**
 * Server-side loader for the published documentation: the beginner course
 * (course/*.md) and the technical docs (docs/*.md) from the repo root. Pages are
 * statically generated at build time, so these fs reads never happen at runtime.
 *
 * PRODUCT.md (internal strategy) is deliberately not published.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type Section = 'course' | 'tech';

const SECTION_DIRS: Record<Section, string> = { course: 'course', tech: 'docs' };
const EXCLUDE = new Set(['PRODUCT.md', 'PITCH.md']);

/** Walk up from cwd (apps/web at build time) to the workspace root. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('workspace root not found');
}

export interface DocEntry {
  section: Section;
  slug: string; // filename without .md
  title: string;
}

function titleOf(markdown: string, fallback: string): string {
  const heading = markdown.split('\n').find((line) => line.startsWith('# '));
  return heading ? heading.replace(/^#\s+/, '').trim() : fallback;
}

export function listDocs(section: Section): DocEntry[] {
  const dir = join(repoRoot(), SECTION_DIRS[section]);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !EXCLUDE.has(f))
    .sort()
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const content = readFileSync(join(dir, f), 'utf-8');
      return { section, slug, title: titleOf(content, slug) };
    });
}

export function readDoc(section: Section, slug: string): string | undefined {
  // Slug comes from the URL: refuse anything that isn't a plain filename.
  if (!/^[\w.-]+$/.test(slug) || EXCLUDE.has(`${slug}.md`)) return undefined;
  const file = join(repoRoot(), SECTION_DIRS[section], `${slug}.md`);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, 'utf-8');
}

/**
 * Rewrite a markdown link target to a site URL. Handles the cross-references the
 * repo's docs actually use: "./x.md", "../docs/x.md", "../course/x.md", plus
 * repo-root files (PROJECT_PLAN.md etc.) which go to GitHub.
 */
export function resolveDocHref(section: Section, href: string, githubUrl: string): string {
  if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('#'))
    return href;
  const [path, anchor = ''] = href.split('#');
  const hash = anchor ? `#${anchor}` : '';
  const clean = (path ?? '').replace(/^\.\//, '');

  const md = /^(?:\.\.\/)?(course|docs|infra)\/(.+?)(\.md)?$/.exec(clean);
  if (md && md[1] !== 'infra') {
    const target: Section = md[1] === 'course' ? 'course' : 'tech';
    return `/docs/${target}/${(md[2] ?? '').replace(/\.md$/, '')}${hash}`;
  }
  if (clean.endsWith('.md') && !clean.includes('/')) {
    // Sibling file in the same section.
    return `/docs/${section}/${clean.replace(/\.md$/, '')}${hash}`;
  }
  // Anything else (repo files, code paths) → GitHub.
  return `${githubUrl}/blob/main/${clean.replace(/^(\.\.\/)+/, '')}`;
}
