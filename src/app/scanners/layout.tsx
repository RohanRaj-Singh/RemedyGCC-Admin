'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

export default function ScannersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeTab="scanners" />
      <main style={{ marginLeft: '16rem' }}>
        {children}
      </main>
    </div>
  );
}
