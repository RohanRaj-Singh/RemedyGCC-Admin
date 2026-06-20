import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';
import { getClinicListData } from '@/server/clinic/repository';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Slug is required.' }, { status: 400 });
    }

    const normalized = slug.toLowerCase().trim();
    const data = await getClinicListData();
    const taken = data.clinics.some((c) => c.slug === normalized);

    return NextResponse.json({ available: !taken });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
