/**
 * Super Admin Dashboard - Root Layout
 * RemedyGCC Control Plane
 */

import type { Metadata } from 'next';
import './globals.css';
import { DevBanner } from '@/components/layout/DevBanner';

export const metadata: Metadata = {
  title: 'RemedyGCC | Super Admin',
  description: 'Super Admin Control Panel for RemedyGCC Multi-tenant Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DevBanner />
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
