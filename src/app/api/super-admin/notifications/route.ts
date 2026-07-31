import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin Notifications
 *
 * Proxies to the Tenant App notifications endpoint with the shared API key.
 * No tenantId/employeeCode params → the Tenant App resolves the recipient
 * as the platform-wide super admin.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const { searchParams } = new URL(request.url);
    const targetUrl = new URL(`${tenantAppUrl}/api/notifications`);
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
