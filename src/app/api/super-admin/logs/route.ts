import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) {
    return auth.response!;
  }

  return NextResponse.json([]);
}
