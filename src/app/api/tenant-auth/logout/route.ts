import { NextRequest, NextResponse } from 'next/server';
import { invalidateTenantSession } from '@/modules/tenant-auth/services/auth-service';
import {
  clearTenantAuthCookiesOnResponse,
  getTenantSessionCookie,
} from '@/modules/tenant-auth/utils/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sessionToken = await getTenantSessionCookie();

  if (sessionToken) {
    await invalidateTenantSession(sessionToken);
  }

  const acceptsJson = request.headers.get('accept')?.includes('application/json');
  const response = acceptsJson
    ? NextResponse.json({ success: true })
    : NextResponse.redirect(new URL('/tenant-login', request.url), { status: 303 });

  return clearTenantAuthCookiesOnResponse(response);
}
