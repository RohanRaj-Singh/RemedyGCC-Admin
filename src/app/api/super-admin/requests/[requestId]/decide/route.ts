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
 * Super Admin Requests — decide endpoint
 *
 * Super Admin is granted cross-tenant oversight on Requests (same scope as
 * chat / claim access). The actual Request state transition lives in
 * `tenantapp/src/server/services/claimRequestService.decideClaimRequest` —
 * which has been gated to allow `superAdmin` alongside `tenantAdmin`.
 *
 * This endpoint:
 *   1. Resolves `requestId → claimId` via direct-Mongo (read-only lookup).
 *   2. Proxies the decide POST to `${TENANT_APP_URL}/api/reimbursements/<claimId>/requests/<requestId>/decide`
 *      with the `x-admin-api-key` header. That lands in `resolveChatParticipant`'s
 *      superAdmin branch (no tenantId / employeeCode → role = "superAdmin"),
 *      which now passes the service-layer role gate.
 *   3. Returns the updated Request document (or surfaces the upstream error).
 *
 * The Admin never accepts the requester, responder, tenant scope, or role from
 * a client field — all of that is derived from the stored Request + the
 * verified Super Admin auth.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;
  if (auth.adminRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    const { requestId } = await context.params;
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
    console.log("[DEBUG] About to run Mongo lookup...");
    console.log("[DEBUG] Using requestId:", requestId);
    const lookup = await runMongoScript<{ claimId: string | null; status: string | null }>(
      `
        print('[DIAG_DB]', db.getName());
        print('[DIAG_ID]', __payload.requestId);
        var _c = db.claimRequests.countDocuments();
        print('[DIAG_COUNT]', _c);
        const req = db.claimRequests.findOne(
          { requestId: __payload.requestId },
          { projection: { claimId: 1, status: 1 } },
        );
        if (!req) { print('[DIAG] findOne returned null'); __emit({ claimId: null, status: null }); quit(0); }
        print('[DIAG] req fields:', Object.keys(req));
        print('[DIAG] claimId:', req.claimId);
        print('[DIAG] status:', req.status);
        __emit({ claimId: req.claimId, status: req.status });
      `,
      { requestId },
      { label: 'super-admin-requests-decide-lookup', targetDb: 'remedygcc' },
    );

    console.log("[DEBUG] Lookup result:", JSON.stringify(lookup));
    if (!lookup || !lookup.claimId) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    if (lookup.status && lookup.status !== 'pending') {
      return NextResponse.json(
        { error: 'Request has already been decided.' },
        { status: 409 },
      );
    }

    // Proxy the decision to the tenantapp — the authority for Request state.
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
    console.error('[super-admin/requests/[id]/decide] proxy failed:', error);
    return apiErrorResponse(error, 500);
  }
}