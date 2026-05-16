import { NextRequest, NextResponse } from 'next/server';
import { getTenantStats } from '@/modules/tenant/service';
import { apiErrorResponse } from '../_utils';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const stats = await getTenantStats();

    return NextResponse.json({
      totalTenants: stats.total,
      activeTenants: stats.active,
      draftTenants: stats.draft,
      disabledTenants: stats.disabled,
      archivedTenants: stats.archived,
      activeRuntimeConfigs: stats.activeRuntimeConfigs,
      activeScanners: 0,
      totalLogs: 0,
      totalSubmissions: stats.totalSubmissions,
      avgScore: 0,
      tenantsByBranding: {
        custom: stats.byBranding.custom,
        default: stats.byBranding.default,
        withWarnings: stats.byBranding.warnings,
      },
      recentActivity: [],
    });
  } catch (error) {
    return apiErrorResponse(error, 500);
  }
}
