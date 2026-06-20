import { NextResponse } from 'next/server';
import { getAllClinics } from '@/modules/clinic/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public clinic listing — no auth required.
 * Used by the marketing site to display clinic directory data.
 */
export async function GET() {
  try {
    const clinics = await getAllClinics();
    return NextResponse.json(clinics);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch clinics.' },
      { status: 500 },
    );
  }
}
