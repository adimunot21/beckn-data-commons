import { NextResponse } from 'next/server';
import { SignedAccessGrant } from '@bdc/beckn-schemas';
import { download } from '@/lib/bdc';

/**
 * Redeem a grant at the provider and return a preview. The client sends the
 * signed grant back to us — deliberately: in the sandbox the browser *holds* the
 * consent artifact, which is exactly the mental model the product teaches.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { grant?: unknown; accessUrl?: string };
  const parsed = SignedAccessGrant.safeParse(body.grant);
  if (!parsed.success || !body.accessUrl || typeof body.accessUrl !== 'string') {
    return NextResponse.json(
      { error: 'bad-request', detail: 'a valid signed grant and accessUrl are required' },
      { status: 400 },
    );
  }
  try {
    const result = await download(body.accessUrl, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: 'backend-unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
