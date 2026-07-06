import { NextResponse } from 'next/server';
import { getAllClinics } from '@/modules/clinic/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public clinic listing — no auth required.
 * Used by the marketing site to display clinic directory data.
 * Only returns active clinics — never exposes archived or inactive clinics.
 */
export async function GET() {
  try {
    const clinics = await getAllClinics();
    // Only expose active clinics to the public
    const active = clinics.filter((c) => c.status === "active");
    return NextResponse.json(active);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch clinics.' },
      { status: 500 },
    );
  }
}
