import { NextRequest, NextResponse } from 'next/server';
import { activateRuntimeConfig } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => ({}));
    const runtimeConfigId = body?.runtimeConfigId;

    if (!runtimeConfigId || typeof runtimeConfigId !== 'string') {
      throw new Error('Runtime configuration id is required.');
    }

    const tenant = await activateRuntimeConfig(context.params.id, runtimeConfigId);
    return NextResponse.json(tenant);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
