import { NextRequest, NextResponse } from 'next/server';
import { deleteTenant, getTenantById, previewDeleteTenant, updateTenant } from '@/modules/tenant/service';
import { apiErrorResponse } from '../_utils';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const tenant = await getTenantById(context.params.id);
    if (!tenant) {
      return apiErrorResponse(new Error('Tenant not found.'), 404);
    }

    return NextResponse.json(tenant);
  } catch (error) {
    return apiErrorResponse(error, 500);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json();
    const tenant = await updateTenant(context.params.id, body);
    return NextResponse.json(tenant);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json().catch(() => null);

    // Phase 1 — preview: no confirmation body → return consequences directly
    if (!body) {
      const consequences = await previewDeleteTenant(context.params.id);
      return NextResponse.json(consequences);
    }

    // Phase 2 — execute: requires slug + acknowledgeDataLoss
    await deleteTenant(context.params.id, {
      slug: body.slug,
      acknowledgeDataLoss: Boolean(body.acknowledgeDataLoss),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
