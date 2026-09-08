import { NextRequest, NextResponse } from 'next/server';
import { runMongoScript } from '@/server/mongo-shell';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';
import { handleProxyResponse, proxyToTenantApp } from '@/app/api/super-admin/_proxy-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Super Admin Request Decisions — FLAT route (NO dynamic segments)
 *
 * Handles approve/reject decisions for requests.
 * Uses query params to avoid Next.js App Router bug where dynamic segment
 * routes cannot register non-GET HTTP method exports.
 *
 * POST /api/super-admin/decide?requestId=xxx
 * Body: { decision: 'approved'|'rejected'|'more_info'|'converted_to_chat', notes?: string }
 */
const VALID_DECISIONS = ['approved', 'rejected', 'more_info', 'converted_to_chat'] as const;
type Decision = (typeof VALID_DECISIONS)[number];

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;
  if (auth.adminRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    // Extract requestId from query params (since flat routes can't use path params)
    const url = new URL(request.url);
    const requestId = url.searchParams.get('requestId');
    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId query param.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { decision, notes } = body ?? {};

    if (!VALID_DECISIONS.includes(decision as Decision)) {
      return NextResponse.json(
        { error: 'Invalid decision.', errorCode: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    // Resolve claimId from the Request document (read-only lookup).
    // NOTE: do NOT use mongosh projection — it returns empty objects for the
    // projected fields via __emit. Fetch the whole doc and extract fields directly.
    const lookup = await runMongoScript<{ claimId: string | null; status: string | null }>(
      `
        const req = db.claimRequests.findOne({ requestId: __payload.requestId });
        if (!req) { __emit({ claimId: null, status: null }); quit(0); }
        __emit({ claimId: req.claimId || null, status: req.status || null });
      `,
      { requestId },
      { label: 'super-admin-decide-lookup', targetDb: 'remedygcc' },
    );

    console.log('[DIAG-MONGO-DECIDE] Lookup result:', JSON.stringify(lookup));
    if (!lookup || !lookup.claimId) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    if (lookup.status && lookup.status !== 'pending') {
      return NextResponse.json(
        { error: 'Request has already been decided.' },
        { status: 409 },
      );
    }

    // Proxy the decision to the tenantApp — the authority for Request state.
    const tenantAppPath =
      `/api/reimbursements/${encodeURIComponent(lookup.claimId)}` +
      `/requests/${encodeURIComponent(requestId)}/decide`;

    const proxyBody: { decision: Decision; notes?: string } = {
      decision: decision as Decision,
    };
    if (typeof notes === 'string' && notes.trim()) {
      proxyBody.notes = notes.trim();
    }

    const upstream = await proxyToTenantApp(tenantAppPath, 'POST', { body: proxyBody });
    return handleProxyResponse(upstream);
  } catch (error) {
    console.error('[super-admin/decide] decide failed:', error);
    return apiErrorResponse(error, 500);
  }
}
