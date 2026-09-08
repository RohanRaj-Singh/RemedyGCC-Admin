'use client';

/**
 * Super Admin Dashboard — command center.
 *
 * The chrome (Header + Sidebar) is rendered by `app/(authenticated)/layout.tsx`.
 * This page renders only the main content area.
 */

import { DashboardView } from '@/components/dashboard';

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <DashboardView />
    </div>
  );
}
