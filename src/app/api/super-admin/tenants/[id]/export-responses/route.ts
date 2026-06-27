/**
 * Export Responses API Route
 *
 * Generates an .xlsx workbook of completed survey responses for a tenant.
 *
 * Authorization: Super Admin only.
 * Scope: Single tenant — cross-tenant data access is blocked by design.
 *
 * GET /api/super-admin/tenants/:id/export-responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { generateResponseExport } from '@/services/response-export-service';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  // --- Authorization ---
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    // --- Generate export ---
    const { buffer, filename, responseCount } = await generateResponseExport(
      context.params.id,
    );

    // --- Return as downloadable file ---
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    // Return user-friendly messages — no internal details exposed
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to generate export. Please try again.';

    return NextResponse.json({ error: message }, { status: 422 });
  }
}
