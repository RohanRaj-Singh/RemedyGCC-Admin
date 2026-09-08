import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin — Generate Invoice
 *
 * Proxies to the Tenant App's `/api/invoices/generate` endpoint with the shared
 * API key. Body: `{ tenantId, claimIds, generatedBy }`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json();
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const response = await fetch(`${tenantAppUrl}/api/invoices/generate`, {
      method: 'POST',
      headers: {
        'x-admin-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 502);
  }
}
