/**
 * Auth Utilities - Cookie Operations Only
 * These functions only handle HTTP cookies, no DB access
 */

import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'admin_session';

// Cookie configuration
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}

/**
 * Set session cookie
 */
export async function setSessionCookie(sessionToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, getCookieOptions());
}

/**
 * Get session cookie value
 */
export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get session token for server actions
 */
export async function getAuthToken(): Promise<string | null> {
  const cookie = await getSessionCookie();
  return cookie ?? null;
}

/**
 * Check if user is on login page (to avoid redirect loops)
 */
export function isLoginPage(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login');
}

/**
 * Check if path should be public (not requiring auth)
 */
export function isPublicPath(pathname: string): boolean {
  // Public paths that don't require authentication
  const publicPaths = [
    '/login',
    '/api/auth/login',
    '/api/auth/logout',
  ];

  // Check exact matches
  if (publicPaths.includes(pathname)) {
    return true;
  }

  // Tenant runtime routes should always be public
  if (pathname.startsWith('/api/survey') || pathname.startsWith('/survey')) {
    return true;
  }

  return false;
}

/**
 * Check if path requires admin auth
 */
export function requiresAuth(pathname: string): boolean {
  // Skip auth for login page itself
  if (isLoginPage(pathname)) {
    return false;
  }

  // Check for admin routes
  const adminPaths = [
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

  return adminPaths.some(path => pathname.startsWith(path));
}