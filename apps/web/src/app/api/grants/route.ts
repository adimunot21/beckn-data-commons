import { NextResponse } from 'next/server';
import { listGrants } from '@/lib/bdc';

export async function GET(request: Request): Promise<NextResponse> {
  const grantee = new URL(request.url).searchParams.get('grantee');
  if (!grantee) {
    return NextResponse.json(
      { error: 'bad-request', detail: 'grantee is required' },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ grants: await listGrants(grantee) });
  } catch (err) {
    return NextResponse.json(
      { error: 'backend-unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
