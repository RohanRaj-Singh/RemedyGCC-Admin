'use client';

import AuthenticatedShell from '@/app/(authenticated)/layout';
import { DashboardView } from '@/components/dashboard';

export default function RootPage() {
  return (
    <AuthenticatedShell>
      <DashboardView />
    </AuthenticatedShell>
  );
}
