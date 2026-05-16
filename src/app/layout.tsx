/**
 * Super Admin Dashboard - Root Layout
 * RemedyGCC Control Plane
 */

import type { Metadata } from 'next';
import './globals.css';
import { DevBanner } from '@/components/layout/DevBanner';
import { ThemeProvider } from '@/context/ThemeProvider';
import { DEFAULT_BRANDING } from '@/types/branding';
import { AuthProvider } from '@/context/AuthProvider';

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
        <ThemeProvider defaultBranding={DEFAULT_BRANDING}>
          <AuthProvider>
            <div className="min-h-screen">
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}