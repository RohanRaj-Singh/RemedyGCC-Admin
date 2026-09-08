import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Trivially simple POST — only imports next/server, no dependencies */
export async function POST(request: NextRequest) {
  console.log('[TEST-TRIVIAL-POST-HIT]', request.url);
  return NextResponse.json({ test: true, url: request.url });
}
