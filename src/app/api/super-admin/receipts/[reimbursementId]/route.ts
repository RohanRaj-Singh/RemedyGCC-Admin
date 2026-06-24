import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

const TENANT_APP_URL = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? '';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reimbursementId: string }> },
) {
  const auth = await requireApiAuth(_request);
  if (!auth.success) return auth.response!;

  try {
    const { reimbursementId } = await context.params;

    const tenantRes = await fetch(
      `${TENANT_APP_URL}/api/admin/receipts?reimbursementId=${encodeURIComponent(reimbursementId)}`,
      {
        method: 'GET',
        headers: { 'x-admin-api-key': ADMIN_API_KEY },
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!tenantRes.ok) {
      const errorBody = await tenantRes.json().catch(() => null);
      return NextResponse.json(
        { error: errorBody?.error ?? 'Failed to retrieve receipt.' },
        { status: tenantRes.status },
      );
    }

    const contentType = tenantRes.headers.get('content-type') ?? 'application/octet-stream';
    const contentLength = tenantRes.headers.get('content-length');
    const contentDisposition = tenantRes.headers.get('content-disposition') ?? 'inline';

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
    };
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    return new NextResponse(tenantRes.body, {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to retrieve receipt. Please try again.' },
      { status: 503 },
    );
  }
}
