import { NextRequest, NextResponse } from 'next/server';
import { runMongoScript } from '@/server/mongo-shell';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '../../tenants/_utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/notifications/unread-count
 *
 * Phase C — R1 (Direct Mongo migration).
 *
 * Returns the count of unread notifications addressed to the Super Admin
 * recipient (the verified identity, never a client-supplied recipientId).
 *
 * Super Admin notification rows are stored with:
 *   recipientType = "superAdmin"
 *   recipientId   = "super-admin"
 *   tenantId      = ""        (super-admin is not bound to a tenant)
 *
 * Response contract (preserved):
 *   { count: number }   HTTP 200
 *
 * Auth: superAdmin only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response;
  if (auth.adminRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    const result = await runMongoScript<{ count: number }>(
      `
        const count = db.notifications.countDocuments({
          tenantId: "",
          recipientType: "superAdmin",
          recipientId: "super-admin",
          read: false,
        });
        __emit({ count });
      `,
      undefined,
      { label: 'notifications-unread-count', targetDb: 'remedygcc' },
    );

    return NextResponse.json({ count: result.count ?? 0 });
  } catch (error) {
    console.error('[notifications/unread-count] direct mongo failed:', error);
    return apiErrorResponse(error, 500);
  }
}
