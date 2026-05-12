import { NextResponse } from 'next/server';

export function apiErrorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: {
        message: error instanceof Error ? error.message : 'Unexpected tenant module error.',
      },
    },
    { status },
  );
}
