import { NextRequest, NextResponse } from 'next/server';
import { getTenantPublishingPreview } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const preview = await getTenantPublishingPreview(context.params.id);
    return NextResponse.json(preview);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
