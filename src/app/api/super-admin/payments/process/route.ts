import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin Payout Processing
 *
 * Proxies to the Tenant App's `/api/admin/payments/process` endpoint with the
 * shared API key. Body: `{ claimIds?: string[] }` (empty = process every
 * `to_be_paid` claim). Returns `{ processed: number }`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const body = await request.json().catch(() => ({}));

    const res = await fetch(`${tenantAppUrl}/api/admin/payments/process`, {
      method: 'POST',
      headers: { 'x-admin-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      return NextResponse.json(
        { error: errorBody?.error ?? `Tenant App returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, 502);
  }
}
