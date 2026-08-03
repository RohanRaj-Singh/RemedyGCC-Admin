import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin Budget History
 *
 * Proxies to the Tenant App's admin budget history endpoint with the shared
 * API key. Returns the budget history entries for the tenant (newest first)
 * with optional `type`, `skip`, and `limit` query params forwarded through.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const { tenantId } = await context.params;
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const { searchParams } = new URL(request.url);
    const targetUrl = new URL(
      `${tenantAppUrl}/api/admin/budgets/${tenantId}/history`,
    );
    for (const [key, value] of searchParams.entries()) {
      targetUrl.searchParams.set(key, value);
    }

    const res = await fetch(targetUrl.toString(), {
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
