function normalizeCookieDomain(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function getAdminAuthCookieDomain() {
  return normalizeCookieDomain(process.env.ADMIN_AUTH_COOKIE_DOMAIN);
}

export function getAdminAuthCookieBaseOptions() {
  const domain = getAdminAuthCookieDomain();

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

