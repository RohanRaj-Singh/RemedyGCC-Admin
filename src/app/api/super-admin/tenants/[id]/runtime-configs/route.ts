import { NextResponse } from 'next/server';
import { getRuntimeConfigOptionsForTenant } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const options = await getRuntimeConfigOptionsForTenant(context.params.id);
    return NextResponse.json(options);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
