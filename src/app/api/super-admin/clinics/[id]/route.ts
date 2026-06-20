import { NextRequest, NextResponse } from 'next/server';
import {
  getClinicById,
  updateClinic,
  deleteClinic,
  previewDeleteClinic,
} from '@/modules/clinic/service';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const clinic = await getClinicById(context.params.id);
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 });
    }
    return NextResponse.json(clinic);
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
    const clinic = await updateClinic(context.params.id, body);
    return NextResponse.json(clinic);
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

    // Phase 1 — preview: return consequences
    if (!body) {
      const consequences = await previewDeleteClinic(context.params.id);
      return NextResponse.json(consequences);
    }

    // Phase 2 — execute deletion with slug confirmation
    await deleteClinic(context.params.id, {
      slug: body.slug,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
