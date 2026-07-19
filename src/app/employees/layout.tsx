'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function EmployeesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeTab="employees" />
      <main style={{ marginLeft: '16rem' }}>
        {children}
      </main>
    </div>
  );
}
