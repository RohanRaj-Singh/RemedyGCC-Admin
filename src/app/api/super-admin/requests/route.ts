import { NextRequest, NextResponse } from 'next/server';
import { runMongoScript } from '@/server/mongo-shell';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Super Admin Requests — list endpoint
 *
 * Reads are direct-Mongo (read-only, no business logic to bypass).
 *   The ServerApp's authoritative business logic for *writes* still lives
 *   in tenantapp/src/server/services/claimRequestService — Admin must
 *   call that path (see /api/super-admin/requests/[id]/decide) to decide.
 *
 * Filters supported (all optional, all derived from the request — never from
 * a client body):
 *   status         — pending | approved | rejected | more_info | converted_to_chat
 *   tenantId       — exact tenantId
 *   claimId        — exact claimId
 *   requesterRole  — employee | clinic | tenantAdmin
 *   search         — case-insensitive match on subject or body
 *   limit, skip    — pagination (defaults: limit=50, skip=0)
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;
  if (auth.adminRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filters: Record<string, unknown> = {};
  const validStatuses = ['pending', 'approved', 'rejected', 'more_info', 'converted_to_chat'];
  const status = searchParams.get('status');
  if (status && validStatuses.includes(status)) {
    filters.status = status;
  }
  const tenantId = searchParams.get('tenantId');
  if (tenantId) filters.tenantId = tenantId;
  const claimId = searchParams.get('claimId');
  if (claimId) filters.claimId = claimId;
  const requesterRole = searchParams.get('requesterRole');
  if (requesterRole && ['employee', 'clinic', 'tenantAdmin'].includes(requesterRole)) {
    filters['requester.role'] = requesterRole;
  }
  const search = searchParams.get('search')?.trim();
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filters.$or = [{ subject: regex }, { body: regex }];
  }

  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 200);
  const skip = Math.max(parseInt(searchParams.get('skip') ?? '0', 10) || 0, 0);

  try {
    const result = await runMongoScript<{
      requests: unknown[];
      total: number;
    }>(
      `
        const filter = __payload.filters;
        const limit = __payload.limit;
        const skip = __payload.skip;
        const docs = db.claimRequests
          .find(filter, { projection: { _id: 0 } })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        const total = db.claimRequests.countDocuments(filter);
        __emit({ requests: __strip(docs), total });
      `,
      { filters, limit, skip },
      { label: 'super-admin-requests-list', targetDb: 'remedygcc' },
    );
    return NextResponse.json(
      { requests: result.requests ?? [], total: result.total ?? 0, limit, skip },
      { status: 200 },
    );
  } catch (error) {
    console.error('[super-admin/requests] list failed:', error);
    return apiErrorResponse(error, 500);
  }
}
