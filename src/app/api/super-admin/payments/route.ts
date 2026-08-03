import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin Payment Queue
 *
 * Proxies to the Tenant App's `/api/admin/payments` endpoint with the shared
 * API key. Returns the payout queue (`to_be_paid` claims) grouped by clinic:
 * `{ groups: [{ clinicId, clinicName, totalAmount, count, claims }], total }`.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const params = new URLSearchParams();
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (tenantId) params.set('tenantId', tenantId);

    const suffix = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${tenantAppUrl}/api/admin/payments${suffix}`, {
      method: 'GET',
      headers: { 'x-admin-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return NextResponse.json(
        { error: body?.error ?? `Tenant App returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, 502);
  }
}
