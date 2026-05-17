import { NextResponse } from 'next/server';
import { requireTenantApiAuth } from '@/modules/tenant-auth/middleware/tenant-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireTenantApiAuth({ allowPasswordChange: true });
  if (!auth.success) {
    return auth.response;
  }

  return NextResponse.json({
    authenticated: true,
    user: auth.context.user,
    tenantStatus: auth.context.tenantStatus,
    redirectTo: auth.context.user.mustChangePassword
      ? '/dashboard/change-password'
      : '/dashboard',
  });
}
