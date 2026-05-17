import type { NextRequest } from 'next/server';
import { TENANT_AUTH_CONFIG } from '../contracts/types';

export const TENANT_LOGIN_PATH = '/tenant-login';
export const TENANT_PASSWORD_CHANGE_PATH = '/dashboard/change-password';
export const TENANT_SESSION_COOKIE = TENANT_AUTH_CONFIG.sessionCookieName;
export const TENANT_PASSWORD_CHANGE_COOKIE = TENANT_AUTH_CONFIG.passwordChangeCookieName;

const TENANT_PROTECTED_PREFIXES = ['/dashboard', '/analytics', '/reports'] as const;
const TENANT_PUBLIC_PREFIXES = [
  TENANT_LOGIN_PATH,
  '/api/tenant-auth/login',
  '/api/tenant-auth/logout',
  '/api/tenant-auth/me',
  '/api/tenant-auth/change-password',
] as const;

export function isTenantProtectedPath(pathname: string): boolean {
  return TENANT_PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isTenantPublicPath(pathname: string): boolean {
  return TENANT_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isValidTenantSessionTokenFormat(token: string | undefined): boolean {
  return token ? /^tds_[0-9a-f]{64}$/i.test(token) : false;
}

export function shouldForceTenantPasswordChange(request: NextRequest): boolean {
  return request.cookies.get(TENANT_PASSWORD_CHANGE_COOKIE)?.value === '1';
}

export function getTenantSessionCookieFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(TENANT_SESSION_COOKIE)?.value;
}
