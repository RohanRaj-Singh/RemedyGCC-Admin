import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';
import {
  createTenantDashboardAccess,
  disableTenantDashboardAccess,
  getTenantDashboardAccess,
  reactivateTenantDashboardAccess,
} from '@/modules/tenant-auth/services/auth-service';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const access = await getTenantDashboardAccess(context.params.id);
    return NextResponse.json(access);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json();
    const access = await createTenantDashboardAccess({
      tenantId: context.params.id,
      email: String(body?.email ?? ''),
      username: String(body?.username ?? ''),
      password: String(body?.password ?? ''),
    });
    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json();
    const action = String(body?.action ?? '').trim().toLowerCase();

    if (action === 'disable') {
      const access = await disableTenantDashboardAccess(context.params.id);
      return NextResponse.json(access);
    }

    if (action === 'reactivate') {
      const access = await reactivateTenantDashboardAccess(context.params.id);
      return NextResponse.json(access);
    }

    return apiErrorResponse(new Error('Unsupported tenant dashboard access action.'), 400);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
