import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin — Bulk Issue Invoices
 *
 * Proxies to the Tenant App's `/api/invoices/bulk-issue` endpoint.
 * Body: `{ invoiceIds: string[] }`. The tenant app validates EVERY invoice
 * individually with the same state rules as the single-invoice workflow and
 * reports per-item successes/failures (`{ processed, rejected[] }`) — a bulk
 * action never bypasses per-invoice validation.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const res = await fetch(`${tenantAppUrl}/api/invoices/bulk-issue`, {
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