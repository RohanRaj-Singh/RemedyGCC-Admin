import { NextRequest, NextResponse } from 'next/server';
import { publishTenantRuntime } from '@/modules/tenant/service';
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
    const result = await publishTenantRuntime(context.params.id, {
      activate: body?.activate !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
