/**
 * Attribute Templates Layout
 * Wraps attribute-template pages with unified sidebar navigation
 */

'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';

export default function AttributeTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Determine active tab based on current path
  const getActiveTab = () => {
    if (pathname.startsWith('/attribute-templates')) return 'attribute-templates';
    return 'attribute-templates';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--muted)' }}>
      {/* Unified Sidebar Component */}
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