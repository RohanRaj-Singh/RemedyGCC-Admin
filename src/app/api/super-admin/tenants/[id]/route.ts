import { NextRequest, NextResponse } from 'next/server';
import { deleteTenant, getTenantById, updateTenant } from '@/modules/tenant/service';
import { apiErrorResponse } from '../_utils';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
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
  try {
    const body = await request.json().catch(() => ({}));
    await deleteTenant(context.params.id, body?.confirmationText);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
