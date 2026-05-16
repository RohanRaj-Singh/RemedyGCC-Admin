import { NextRequest, NextResponse } from 'next/server';
import { createTenant, getAllTenants } from '@/modules/tenant/service';
import { apiErrorResponse } from './_utils';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const tenants = await getAllTenants();
    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? '';

    const filtered = tenants.filter((tenant) => {
      const matchesStatus = status ? tenant.status === status : true;
      const matchesSearch = search
        ? tenant.name.toLowerCase().includes(search)
          || tenant.slug.toLowerCase().includes(search)
          || tenant.subdomain.toLowerCase().includes(search)
          || (tenant.activeRuntimeConfigId ?? '').toLowerCase().includes(search)
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
    const tenant = await createTenant(body);
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
