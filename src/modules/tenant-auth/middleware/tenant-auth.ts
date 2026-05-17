import { NextResponse } from 'next/server';
import type { TenantAuthContext } from '../contracts/types';
import { validateTenantSession } from '../services/auth-service';
import {
  clearTenantAuthCookiesOnResponse,
  getTenantSessionCookie,
} from '../utils/cookies';

export interface TenantApiAuthGuardOptions {
  allowPasswordChange?: boolean;
}

export async function getCurrentTenantAuthContext(): Promise<TenantAuthContext | null> {
  const sessionToken = await getTenantSessionCookie();
  if (!sessionToken) {
    return null;
  }

  return validateTenantSession(sessionToken);
}

export async function getCurrentTenantUser() {
  const context = await getCurrentTenantAuthContext();
  return context?.user ?? null;
}

export async function requireTenantApiAuth(
  options: TenantApiAuthGuardOptions = {},
): Promise<
  | { success: true; context: TenantAuthContext }
  | { success: false; response: NextResponse }
> {
  const context = await getCurrentTenantAuthContext();

  if (!context) {
    return {
      success: false,
      response: clearTenantAuthCookiesOnResponse(
        NextResponse.json(
          { error: 'Tenant authentication required.' },
          { status: 401 },
        ),
      ),
    };
  }

  if (context.user.mustChangePassword && !options.allowPasswordChange) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Password change is required before accessing the dashboard.',
          redirectTo: '/dashboard/change-password',
        },
        { status: 403 },
      ),
    };
  }

  return {
    success: true,
    context,
  };
}
