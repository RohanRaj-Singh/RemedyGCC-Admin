import { NextRequest, NextResponse } from 'next/server';
import { activateRuntimeConfig } from '@/modules/tenant/service';
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
