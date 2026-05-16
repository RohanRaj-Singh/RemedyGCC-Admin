import { NextRequest, NextResponse } from 'next/server';
import { checkSubdomainAvailable } from '@/modules/tenant/service';
import { apiErrorResponse } from '../_utils';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const body = await request.json();
    const { subdomain } = body;

    if (!subdomain || typeof subdomain !== 'string') {
      return NextResponse.json(
        { error: 'Subdomain is required.' },
        { status: 400 }
      );
    }

    const normalizedSubdomain = subdomain.toLowerCase().trim();
    const available = await checkSubdomainAvailable(normalizedSubdomain);

    return NextResponse.json({ available });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}