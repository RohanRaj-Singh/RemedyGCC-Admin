import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin Queue for Payment
 *
 * Proxies to the Tenant App's `/api/reimbursements/:id/queue-payment` endpoint
 * with the shared API key. Moves an approved claim to `to_be_paid` so it enters
 * the payout queue.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const { id } = await context.params;
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const body = await request.json().catch(() => ({}));

    const res = await fetch(`${tenantAppUrl}/api/reimbursements/${id}/queue-payment`, {
      method: 'POST',
      headers: { 'x-admin-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      return NextResponse.json(
        { error: errorBody?.error ?? 'Queue for payment failed.' },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, 502);
  }
}
