'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeTab="payments" />
      <main style={{ marginLeft: '16rem' }}>
        {children}
      </main>
    </div>
  );
}
