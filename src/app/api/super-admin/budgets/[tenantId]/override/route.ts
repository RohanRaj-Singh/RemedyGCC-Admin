import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin Budget Override
 *
 * Proxies to the Tenant App's admin budget override endpoint with the shared
 * API key. Sets a new annual budget ceiling (`totalAmount`) with an optional
 * `year` and `reason`. The Tenant App writes an `override` budget-history
 * entry for the audit trail and returns the refreshed overview.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const { tenantId } = await context.params;
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';
    const body = await request.json().catch(() => ({}));

    const res = await fetch(
      `${tenantAppUrl}/api/admin/budgets/${tenantId}/override`,
      {
        method: 'POST',
        headers: {
          'x-admin-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      return NextResponse.json(
        { error: errBody?.error ?? `Tenant App returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, 502);
  }
}
