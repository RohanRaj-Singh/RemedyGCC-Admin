import { NextRequest, NextResponse } from 'next/server';
import { runMongoScript } from '@/server/mongo-shell';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/super-admin/reimbursements/:id/messages/read
 *
 * Phase C — R2 (Direct Mongo migration).
 *
 * Marks all claim-chat messages on the thread as read by the Super Admin
 * viewer. Idempotent: subsequent calls with the same viewer key touch 0
 * documents (the readBy $addToSet is a no-op when the value is already
 * present, so modifiedCount drops to 0 on the second call).
 *
 * The Super Admin is not bound to a tenant, so the existence check on the
 * reimbursement must NOT add a tenantId filter.
 *
 * Response contract (preserved):
 *   { count: number }   HTTP 200    // number of messages newly marked read
 *
 *   HTTP 404  if the claim does not exist
 *
 * Auth: any authenticated admin.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const { id: claimId } = await context.params;
    const viewerKey = 'superAdmin:super-admin';

    const result = await runMongoScript<
      | { __notFound: true }
      | { count: number }
    >(
      `
        // Existence check — by claimId only, NO tenantId filter.
        const claim = db.reimbursements.findOne(
          { reimbursementId: __payload.claimId },
          { projection: { reimbursementId: 1 } }
        );

        if (!claim) {
          __emit({ __notFound: true });
          return;
        }

        // Idempotent: $addToSet only adds the viewer key if absent.
        // Same filter shape as the TenantApp repository so we mark the
        // same set of documents: messages authored by someone else that
        // the viewer hasn't yet read.
        const update = db.claimMessages.updateMany(
          {
            claimId: __payload.claimId,
            "participant.key": { $ne: __payload.viewerKey },
            readBy: { $ne: __payload.viewerKey },
          },
          { $addToSet: { readBy: __payload.viewerKey } }
        );

        __emit({ count: update.modifiedCount });
      `,
      { claimId, viewerKey },
      { label: 'reimbursements-id-messages-read', targetDb: 'remedygcc' },
    );

    if ('__notFound' in result) {
      return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
    }

    return NextResponse.json({ count: result.count }, { status: 200 });
  } catch (error) {
    console.error('[reimbursements/:id/messages/read] direct mongo failed:', error);
    return apiErrorResponse(error, 500);
  }
}