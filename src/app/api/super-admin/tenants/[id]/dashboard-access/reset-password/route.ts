import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';
import { resetTenantDashboardPassword } from '@/modules/tenant-auth/services/auth-service';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const result = await resetTenantDashboardPassword(context.params.id);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
