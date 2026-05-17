import { NextRequest, NextResponse } from 'next/server';
import { loginTenantUser } from '@/modules/tenant-auth/services/auth-service';
import { setTenantAuthCookiesOnResponse } from '@/modules/tenant-auth/utils/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSafeTenantRedirectPath(nextPath?: string): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/dashboard';
  }

  return nextPath;
}

function getClientIpAddress(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = String(body?.identifier ?? body?.email ?? '').trim();
    const password = String(body?.password ?? '');
    const requestedNext = String(body?.next ?? '').trim();

    const result = await loginTenantUser(
      {
        identifier,
        password,
      },
      {
        ipAddress: getClientIpAddress(request),
        userAgent: request.headers.get('user-agent'),
      },
    );

    if (!result.success || !result.user || !result.session) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Tenant login failed.',
          retryAfterSeconds: result.retryAfterSeconds ?? 0,
        },
        {
          status: result.reason === 'RATE_LIMITED' ? 429 : 401,
        },
      );
    }

    const redirectTo = result.requiresPasswordChange
      ? '/dashboard/change-password'
      : getSafeTenantRedirectPath(requestedNext);

    const response = NextResponse.json({
      success: true,
      redirectTo,
      user: result.user,
      requiresPasswordChange: result.requiresPasswordChange ?? false,
    });

    return setTenantAuthCookiesOnResponse(
      response,
      result.session.sessionToken,
      Boolean(result.requiresPasswordChange),
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Tenant login failed.',
      },
      { status: 500 },
    );
  }
}
