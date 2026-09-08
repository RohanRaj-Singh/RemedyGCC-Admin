import { NextRequest, NextResponse } from 'next/server';
import { runMongoScript } from '@/server/mongo-shell';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';
import { handleProxyResponse, proxyToTenantApp } from '@/app/api/super-admin/_proxy-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_DECISIONS = ['approved', 'rejected', 'more_info', 'converted_to_chat'] as const;
type Decision = (typeof VALID_DECISIONS)[number];

/**
 * Super Admin Request Decisions endpoint
 *
 * Handles approve/reject decisions for requests via POST.
 * This is a standalone flat route to avoid Next.js App Router bugs with
 * nested dynamic segments + static subdirectories.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;
  if (auth.adminRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    const { id: requestId } = await context.params;
    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId.' }, { status: 400 });
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
    const lookup = await runMongoScript<{ claimId: string | null; status: string | null }>(
      `
        const req = db.claimRequests.findOne(
          { requestId: __payload.requestId },
          { projection: { claimId: 1, status: 1 } },
        );
        if (!req) { __emit({ claimId: null, status: null }); quit(0); }
        __emit({ claimId: req.claimId, status: req.status });
      `,
      { requestId },
      { label: 'super-admin-request-decisions-lookup', targetDb: 'remedygcc' },
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

    // Proxy the decision to the tenantApp - the authority for Request state.
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
    console.error('[super-admin/request-decisions] decide failed:', error);
    return apiErrorResponse(error, 500);
  }
}
