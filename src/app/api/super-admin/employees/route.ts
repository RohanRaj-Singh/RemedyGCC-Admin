import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Admin Employees List API
 *
 * Proxies to the Tenant App's super-admin employees endpoint
 * with a shared API key for authentication.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const { searchParams } = new URL(request.url);

    const targetUrl = new URL(`${tenantAppUrl}/api/super-admin/employees`);
    for (const [key, value] of searchParams.entries()) {
      targetUrl.searchParams.set(key, value);
    }

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'x-admin-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorBody?.error ?? `Tenant App returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, 502);
  }
}
