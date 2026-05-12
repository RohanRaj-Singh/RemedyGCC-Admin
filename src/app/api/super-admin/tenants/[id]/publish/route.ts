import { NextRequest, NextResponse } from 'next/server';
import { publishTenantRuntime } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await publishTenantRuntime(context.params.id, {
      activate: body?.activate !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
