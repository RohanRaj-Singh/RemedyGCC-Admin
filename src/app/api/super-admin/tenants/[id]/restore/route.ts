import { NextRequest, NextResponse } from 'next/server';
import { restoreTenant } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => ({}));
    const newSubdomain = body?.newSubdomain;
    const tenant = await restoreTenant(context.params.id, newSubdomain);
    return NextResponse.json(tenant);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}