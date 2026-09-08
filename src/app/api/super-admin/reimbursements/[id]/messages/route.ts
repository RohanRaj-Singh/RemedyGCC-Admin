import { NextRequest, NextResponse } from 'next/server';
import { runMongoScript } from '@/server/mongo-shell';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/reimbursements/:id/messages
 *
 * Phase C — R2 (Direct Mongo migration).
 *
 * Returns the platform-wide Super Admin claim chat thread for a given claim.
 * The Super Admin is not bound to a tenant, so the existence check on the
 * reimbursement must NOT add a tenantId filter — the claim is the only scope.
 *
 * Response contract (preserved):
 *   {
 *     messages: ClaimMessageDocument[]   // createdAt ASC (chronological)
 *     unreadCount: number               // messages not authored by, nor read by, the viewer
 *   }                                   // HTTP 200
 *
 *   HTTP 404  if the claim does not exist
 *
 * Auth: any authenticated admin may read (the chat thread is shared across
 * the Super Admin identity used for all super-admin readers). The viewer
 * key is the canonical "superAdmin:super-admin" identity.
 */
export async function GET(
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
      | { messages: Record<string, unknown>[]; unreadCount: number }
    >(
      `
        // Existence check — by claimId only, NO tenantId filter.
        // The Super Admin is platform-wide; claims are uniquely keyed by
        // reimbursementId. If it doesn't exist, surface 404 to the caller.
        const claim = db.reimbursements.findOne(
          { reimbursementId: __payload.claimId },
          { projection: { reimbursementId: 1 } }
        );

        if (!claim) {
          __emit({ __notFound: true });
          return;
        }

        // Fetch messages in DB-native reverse-chronological order, then
        // reverse in-JS to match the TenantApp repository contract
        // (createdAt ASC for display). Projection strips the ObjectId.
        const records = db.claimMessages
          .find(
            { claimId: __payload.claimId },
            { projection: { _id: 0 } }
          )
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray();

        const messages = records.reverse();

        // Unread = authored by someone else AND not yet read by the viewer.
        // readBy is a string[]; $ne on an array matches when the value is
        // absent from the array (matches the TenantApp repository semantics).
        const unreadCount = db.claimMessages.countDocuments({
          claimId: __payload.claimId,
          "participant.key": { $ne: __payload.viewerKey },
          readBy: { $ne: __payload.viewerKey },
        });

        __emit(__strip({ messages, unreadCount }));
      `,
      { claimId, viewerKey },
      { label: 'reimbursements-id-messages', targetDb: 'remedygcc' },
    );

    if ('__notFound' in result) {
      return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { messages: result.messages, unreadCount: result.unreadCount },
      { status: 200 },
    );
  } catch (error) {
    console.error('[reimbursements/:id/messages] direct mongo failed:', error);
    return apiErrorResponse(error, 500);
  }
}