import { NextRequest, NextResponse } from 'next/server';
import { restoreTenant } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const newSubdomain = body?.newSubdomain;
    const tenant = await restoreTenant(context.params.id, newSubdomain);
    return NextResponse.json(tenant);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}