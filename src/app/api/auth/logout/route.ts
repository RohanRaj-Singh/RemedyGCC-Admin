/**
 * Logout API Route
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/modules/auth/service';
import {
  clearSessionCookieOnResponse,
  getSessionCookie,
} from '@/modules/auth/utils';

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = await getSessionCookie();

    if (sessionToken) {
      // Invalidate session in database
      await logout(sessionToken);
    }

    return clearSessionCookieOnResponse(NextResponse.json({ success: true }));
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
