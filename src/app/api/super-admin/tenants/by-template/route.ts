import { NextRequest, NextResponse } from 'next/server';
import { getAllTenants } from '@/modules/tenant/service';
import { apiErrorResponse } from '../_utils';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const templateId = request.nextUrl.searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId query parameter is required.' },
        { status: 400 }
      );
    }

    const tenants = await getAllTenants();
    const usingTemplate = tenants.filter(
      (t) => t.draftAttributeTemplateId === templateId
    );

    return NextResponse.json(
      usingTemplate.map((t) => ({
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        status: t.status,
      }))
    );
  } catch (error) {
    return apiErrorResponse(error, 500);
  }
}