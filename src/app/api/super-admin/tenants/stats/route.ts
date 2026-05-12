import { NextResponse } from 'next/server';
import { getTenantStats } from '@/modules/tenant/service';
import { apiErrorResponse } from '../_utils';

export const runtime = 'nodejs';

export async function GET() {
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
