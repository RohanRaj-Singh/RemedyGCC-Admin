/**
 * Tenants Layout
 * Wraps tenant pages with unified sidebar navigation
 */

'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { usePathname } from 'next/navigation';

export default function TenantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Determine active tab based on current path
  const getActiveTab = () => {
    if (pathname.startsWith('/tenants')) return 'tenants';
    return 'tenants';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--muted)' }}>
      {/* Unified Sidebar Component - Deep Forest Green */}
      <Sidebar activeTab={getActiveTab()} />

      {/* Main content */}
      <main className="transition-all duration-300 min-h-screen ml-64">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}