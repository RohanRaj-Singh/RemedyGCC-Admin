/**
 * Current Session API
 * GET /api/auth/me - Returns current authenticated admin info
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/modules/auth/service';
import { getSessionCookie } from '@/modules/auth/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = await getSessionCookie();

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const sessionInfo = await validateSession(sessionToken);

    if (!sessionInfo) {
      return NextResponse.json(
        { error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      admin: {
        id: sessionInfo.admin.id,
        email: sessionInfo.admin.email,
        role: sessionInfo.admin.role,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}
