import { redirect } from 'next/navigation';
import { getCurrentTenantAuthContext } from '../middleware/tenant-auth';

export interface RequireTenantUserOptions {
  allowPasswordChange?: boolean;
  loginPath?: string;
  nextPath?: string;
}

function buildLoginUrl(loginPath: string, nextPath?: string): string {
  if (!nextPath) {
    return loginPath;
  }

  return `${loginPath}?next=${encodeURIComponent(nextPath)}`;
}

export async function getCurrentTenantUserContext() {
  return getCurrentTenantAuthContext();
}

export async function requireCurrentTenantUser(
  options: RequireTenantUserOptions = {},
) {
  const loginPath = options.loginPath ?? '/tenant-login';
  const context = await getCurrentTenantAuthContext();

  if (!context) {
    redirect(buildLoginUrl(loginPath, options.nextPath));
  }

  if (context.user.mustChangePassword && !options.allowPasswordChange) {
    redirect('/dashboard/change-password');
  }

  return context;
}
