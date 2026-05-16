/**
 * Authentication Middleware
 * Protects admin routes and validates sessions
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from '@/modules/auth/utils';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/validate',
  '/_next', // Next.js internals
  '/favicon.ico',
];

// Paths that are always public (tenant runtime)
const TENANT_PUBLIC_PATHS = [
  '/api/survey',
  '/api/public',
  '/api/health',
];

function isPublicPath(pathname: string): boolean {
  // Check exact public paths
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    return true;
  }

  // Check tenant public paths
  if (TENANT_PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return true;
  }

  // Check if it's a static file or Next.js internal
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return true;
  }

  return false;
}

function requiresAuth(pathname: string): boolean {
  // Skip auth check for public paths
  if (isPublicPath(pathname)) {
    return false;
  }

  // Check if path starts with protected admin routes
  const protectedPrefixes = [
    '/scanners',
    '/attribute-templates',
    '/tenants',
    '/settings',
    '/logs',
    '/api/super-admin',
    '/api/scanners',
    '/api/attribute-templates',
    '/api/tenants',
  ];

  return protectedPrefixes.some(prefix => pathname.startsWith(prefix));
}

/**
 * Validate session token format (not actual DB validation - that's done in API routes)
 * This is a lightweight check to avoid unnecessary DB queries in middleware
 */
function isValidSessionFormat(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  // Basic format check - UUID format + random suffix
  return token.length > 36 && token.includes('-');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check if path requires authentication
  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const sessionToken = await getSessionCookie();

  if (!sessionToken) {
    // No session token - redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Basic format validation (actual DB validation happens in API routes)
  if (!isValidSessionFormat(sessionToken)) {
    // Invalid token format - clear cookie and redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Session expired. Please log in again.' },
        { status: 401 }
      );
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('admin_session');
    return response;
  }

  // Valid session format - allow request
  // API routes must perform actual session validation before allowing operations
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};