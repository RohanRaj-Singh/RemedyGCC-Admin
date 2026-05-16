/**
 * Authentication Guard for API Routes
 * Validates session before allowing access to protected endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/modules/auth/service';
import { getSessionCookie } from '@/modules/auth/utils';

export interface AuthGuardResult {
  success: boolean;
  response?: NextResponse;
  adminId?: string;
  adminEmail?: string;
  adminRole?: string;
}

/**
 * Validate session and return admin info if valid
 * Should be called at the start of protected API routes
 */
export async function requireApiAuth(request: NextRequest): Promise<AuthGuardResult> {
  const sessionToken = await getSessionCookie();

  if (!sessionToken) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      ),
    };
  }

  const sessionInfo = await validateSession(sessionToken);

  if (!sessionInfo) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Session expired. Please log in again.' },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    adminId: sessionInfo.admin.id,
    adminEmail: sessionInfo.admin.email,
    adminRole: sessionInfo.admin.role,
  };
}