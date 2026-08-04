import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

/**
 * Super Admin — Export Organization Invoice CSV
 *
 * Proxies to the Tenant App's `/api/invoices/export/:orgId` endpoint and streams
 * the CSV text back as a downloadable attachment.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const { orgId } = await context.params;
    const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
    const apiKey = process.env.ADMIN_API_KEY ?? '';

    const response = await fetch(`${tenantAppUrl}/api/invoices/export/${orgId}`, {
      method: 'GET',
      headers: { 'x-admin-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorBody?.error ?? `Tenant App returned ${response.status}` },
        { status: response.status },
      );
    }

    const csv = await response.text();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="invoices-${orgId}.csv"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 502);
  }
}
