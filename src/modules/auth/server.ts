/**
 * Server-side auth utilities
 * For use in server components and layouts
 */

import { validateSession } from './service';
import { getSessionCookie } from './utils';

export interface CurrentAdmin {
  id: string;
  email: string;
  role: string;
}

/**
 * Get current admin from session cookie - for server components
 * Returns null if not authenticated
 */
export async function getCurrentAdminFromCookie(): Promise<CurrentAdmin | null> {
  const sessionToken = await getSessionCookie();

  if (!sessionToken) {
    return null;
  }

  const sessionInfo = await validateSession(sessionToken);

  if (!sessionInfo) {
    return null;
  }

  return {
    id: sessionInfo.admin.id,
    email: sessionInfo.admin.email,
    role: sessionInfo.admin.role,
  };
}