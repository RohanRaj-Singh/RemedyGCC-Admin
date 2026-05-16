/**
 * Login API Route
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/modules/auth/service';
import { setSessionCookie } from '@/modules/auth/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Get client info for session
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Attempt login
    const result = await login(
      { email: body.email, password: body.password },
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Login failed.' },
        { status: 401 }
      );
    }

    // Set session cookie
    if (result.sessionToken) {
      await setSessionCookie(result.sessionToken);
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: result.admin?.id,
        email: result.admin?.email,
        role: result.admin?.role,
      },
    });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}