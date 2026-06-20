import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  TENANT_LOGIN_PATH,
  TENANT_PASSWORD_CHANGE_COOKIE,
  TENANT_PASSWORD_CHANGE_PATH,
  TENANT_SESSION_COOKIE,
  getTenantSessionCookieFromRequest,
  isTenantProtectedPath,
  isTenantPublicPath,
  isValidTenantSessionTokenFormat,
  shouldForceTenantPasswordChange,
} from '@/modules/tenant-auth/middleware/route-protection';
import { clearTenantAuthCookiesOnResponse } from '@/modules/tenant-auth/utils/cookies';
import {
  SESSION_COOKIE_NAME as ADMIN_SESSION_COOKIE,
  clearSessionCookieOnResponse,
} from '@/modules/auth/utils';

const ADMIN_PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/validate',
] as const;

const RUNTIME_PUBLIC_PREFIXES = [
  '/api/survey',
  '/api/public',
  '/api/health',
  '/api/tenant-assets',
] as const;

const ADMIN_PROTECTED_PREFIXES = [
  '/',
  '/scanners',
  '/attribute-templates',
  '/tenants',
  '/clinics',
  '/settings',
  '/logs',
  '/api/super-admin',
  '/api/scanners',
  '/api/attribute-templates',
  '/api/tenants',
] as const;

function isStaticOrInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next')
    || pathname.startsWith('/static')
    || pathname === '/favicon.ico'
    || pathname.includes('.')
  );
}

function isRuntimePublicPath(pathname: string): boolean {
  return RUNTIME_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminPublicPath(pathname: string): boolean {
  return ADMIN_PUBLIC_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAdminProtectedPath(pathname: string): boolean {
  if (pathname === '/') {
    return true;
  }

  return ADMIN_PROTECTED_PREFIXES.some(
    (prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

function isValidAdminSessionFormat(token: string | undefined): boolean {
  return Boolean(token && token.length > 36 && token.includes('-'));
}

function redirectToTenantLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL(TENANT_LOGIN_PATH, request.url);
  if (pathname !== TENANT_LOGIN_PATH) {
    loginUrl.searchParams.set('next', pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isStaticOrInternalPath(pathname)
    || isRuntimePublicPath(pathname)
    || isTenantPublicPath(pathname)
    || isAdminPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  if (isTenantProtectedPath(pathname)) {
    const sessionToken = getTenantSessionCookieFromRequest(request);

    if (!sessionToken) {
      return redirectToTenantLogin(request, pathname);
    }

    if (!isValidTenantSessionTokenFormat(sessionToken)) {
      return clearTenantAuthCookiesOnResponse(redirectToTenantLogin(request, pathname));
    }

    if (
      shouldForceTenantPasswordChange(request)
      && pathname !== TENANT_PASSWORD_CHANGE_PATH
    ) {
      return NextResponse.redirect(new URL(TENANT_PASSWORD_CHANGE_PATH, request.url));
    }

    return NextResponse.next();
  }

  if (isAdminProtectedPath(pathname)) {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required.' },
          { status: 401 },
        );
      }

      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!isValidAdminSessionFormat(sessionToken)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Session expired. Please log in again.' },
          { status: 401 },
        );
      }

      const response = NextResponse.redirect(new URL('/login', request.url));
      return clearSessionCookieOnResponse(response);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/tenant-assets).*)',
  ],
};
