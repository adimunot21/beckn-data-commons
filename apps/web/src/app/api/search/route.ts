import { NextResponse } from 'next/server';
import { search, type Json } from '@/lib/bdc';
import { flattenOffers } from '@/lib/offers';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      kind?: string;
      modality?: string;
      taskType?: string;
      licenseClass?: string;
      minRows?: number;
      purpose?: string;
    };
    const intent: Json = {};
    for (const key of [
      'query',
      'kind',
      'modality',
      'taskType',
      'licenseClass',
      'minRows',
    ] as const) {
      if (body[key] !== undefined && body[key] !== '') intent[key] = body[key];
    }
    const resp = await search(intent, body.purpose);
    return NextResponse.json({
      transactionId: resp.transactionId,
      providers: resp.providers,
      offers: flattenOffers(resp),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'backend-unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
