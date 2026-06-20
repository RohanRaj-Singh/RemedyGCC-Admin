import { NextRequest, NextResponse } from 'next/server';
import { getAllClinics, createClinic } from '@/modules/clinic/service';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const clinics = await getAllClinics();
    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? '';

    const filtered = clinics.filter((clinic) => {
      const matchesStatus = status ? clinic.status === status : true;
      const matchesSearch = search
        ? clinic.name.toLowerCase().includes(search)
          || clinic.slug.toLowerCase().includes(search)
          || (clinic.nameAr ?? '').toLowerCase().includes(search)
        : true;
      return matchesStatus && matchesSearch;
    });

    return NextResponse.json(filtered);
  } catch (error) {
    return apiErrorResponse(error, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json();
    const clinic = await createClinic(body);
    return NextResponse.json(clinic, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
