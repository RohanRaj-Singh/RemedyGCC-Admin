import { NextRequest, NextResponse } from 'next/server';
import { archiveTenant } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';

export const runtime = 'nodejs';

export async function POST(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const tenant = await archiveTenant(context.params.id);
    return NextResponse.json(tenant);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}