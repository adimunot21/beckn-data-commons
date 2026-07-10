import { NextResponse } from 'next/server';
import { accessUrlFrom, confirm } from '@/lib/bdc';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    for (const field of [
      'transactionId',
      'bppId',
      'offerId',
      'resourceId',
      'granteeId',
      'purpose',
      'licenseClass',
    ]) {
      if (!b[field] || typeof b[field] !== 'string') {
        return NextResponse.json(
          { error: 'bad-request', detail: `${field} is required` },
          { status: 400 },
        );
      }
    }
    const { contract, grant } = await confirm({
      transactionId: b.transactionId as string,
      bppId: b.bppId as string,
      bppUri: b.bppUri as string | undefined,
      offerId: b.offerId as string,
      resourceId: b.resourceId as string,
      granteeId: b.granteeId as string,
      purpose: b.purpose as string,
      licenseClass: b.licenseClass as string,
      scope: b.scope as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ contract, grant, accessUrl: accessUrlFrom(contract, grant) });
  } catch (err) {
    return NextResponse.json(
      { error: 'confirm-failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
