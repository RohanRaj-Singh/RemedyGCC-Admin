'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function ReimbursementsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeTab="reimbursements" />
      <main style={{ marginLeft: '16rem' }}>
        {children}
      </main>
    </div>
  );
}
