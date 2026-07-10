import { NextResponse } from 'next/server';
import { revokeGrant } from '@/lib/bdc';

export async function POST(
  request: Request,
  context: { params: Promise<{ grantId: string }> },
): Promise<NextResponse> {
  const { grantId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  try {
    const result = await revokeGrant(grantId, body.reason ?? 'revoked via console');
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err) {
    return NextResponse.json(
      { error: 'backend-unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
