import { NextResponse } from 'next/server';
import { getTenantPublishingPreview } from '@/modules/tenant/service';
import { apiErrorResponse } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const preview = await getTenantPublishingPreview(context.params.id);
    return NextResponse.json(preview);
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
