import { NextRequest, NextResponse } from 'next/server';
import { runMongoScript } from '@/server/mongo-shell';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';
import { handleProxyResponse, proxyToTenantApp } from '@/app/api/super-admin/_proxy-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Super Admin Requests — detail endpoint
 *
 * Returns a single Request + minimal context for the detail page:
 *   - Request (claimRequests collection)
 *   - Linked Claim summary (reimbursementId, claimNumber, organization,
 *     clinic, employee, status) — read-only enrichment; SuperAdmin does
 *     not write to the claim via this endpoint.
 *
 * If the Request does not exist → HTTP 404.
 * If the Request exists but the Claim does not → still return the Request
 * with claimDetails: null (the user can still see/act on the orphan).
 */
export async function GET(
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

    const result = await runMongoScript<{
      request: unknown | null;
      claimDetails: unknown | null;
    }>(
      `
        const requestId = __payload.requestId;
        const req = db.claimRequests.findOne(
          { requestId },
          { projection: { _id: 0 } },
        );
        if (!req) { __emit({ request: null, claimDetails: null }); quit(0); }
        const claim = db.reimbursements.findOne(
          { reimbursementId: req.claimId },
          { projection: { _id: 0, claimItems: 0, officialUpdates: 0, paymentInfo: 0, payment: 0 } },
        );
        let claimDetails = null;
        if (claim) {
          const tenant = claim.tenantId
            ? db.tenants.findOne({ tenantId: claim.tenantId }, { projection: { _id: 0, branding: 0 } })
            : null;
          claimDetails = {
            reimbursementId: claim.reimbursementId,
            claimNumber: claim.claimNumber,
            status: claim.status,
            amount: claim.amount ?? claim.totalAmount ?? null,
            organizationName: tenant?.name ?? tenant?.tenantName ?? null,
            clinicName: claim.clinicName ?? null,
            employeeName: claim.employeeName ?? claim.employee?.name ?? null,
            createdAt: claim.createdAt ?? null,
          };
        }
        __emit({ request: __strip(req), claimDetails: claimDetails ? __strip(claimDetails) : null });
      `,
      { requestId },
      { label: 'super-admin-requests-detail', targetDb: 'remedygcc' },
    );

    if (!result || !result.request) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { request: result.request, claimDetails: result.claimDetails },
      { status: 200 },
    );
  } catch (error) {
    console.error('[super-admin/requests/[id]] detail failed:', error);
    return apiErrorResponse(error, 500);
  }
}

const VALID_DECISIONS = ['approved', 'rejected', 'more_info', 'converted_to_chat'] as const;
type Decision = (typeof VALID_DECISIONS)[number];

// NOTE: Temporary minimal POST — replace once working
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  console.log('[DIAG-POST-HIT] Received decision request');
  try {
    const body = await request.json().catch(() => ({}));
    console.log('[DIAG-POST-BODY]', JSON.stringify(body));
    return NextResponse.json({ success: true, receivedBody: body });
  } catch (error) {
    console.error('[DIAG-POST-ERROR]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
