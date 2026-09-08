'use client';

/**
 * Shared authenticated shell for the Super Admin financial / request
 * workspaces (Claims & Billing, Payments, Invoices, Requests).
 *
 * Top-level wrappers are hoisted here (RealtimeProvider, LayoutProvider,
 * TooltipProvider, CommandPalette) so they have a single, stable lifecycle
 * — Header and Sidebar are torn down/re-rendered on navigation, but these
 * keep their state and event listeners alive across the session.
 *
 * The LayoutProvider exposes the collapsed/mobileNav state to both
 * Header and Sidebar so they stay in sync.
 *
 * Layout strategy:
 *   - The sidebar is `position: fixed` on the left edge of the viewport —
 *     bulletproof regardless of scroll containers, parent heights, or
 *     stacking contexts.
 *   - The main column mirrors the sidebar width via inline padding-left so
 *     content never sits under the sidebar.
 */

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { LayoutProvider } from '@/components/layout/LayoutContext';
import { useLayout } from '@/components/layout/LayoutContext';
import { MobileNav } from '@/components/layout/MobileNav';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { TenantsProvider } from '@/context/TenantsProvider';
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const EXPANDED_W_PX = 256; // matches `w-64` in the Sidebar
const COLLAPSED_W_PX = 68; // matches `w-[4.25rem]` in the Sidebar

export default function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <RealtimeProvider>
      <TenantsProvider>
        <LayoutProvider>
          <TooltipProvider delayDuration={250}>
            <Shell>{children}</Shell>
            <CommandPalette />
          </TooltipProvider>
        </LayoutProvider>
      </TenantsProvider>
    </RealtimeProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { sidebarCollapsed } = useLayout();
  const mainPaddingLeft = sidebarCollapsed ? COLLAPSED_W_PX : EXPANDED_W_PX;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed sidebar — pinned to the viewport's left edge, hidden on
          mobile (the MobileNav drawer handles that). */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden md:block transition-[width] duration-300 ease-out',
        )}
        style={{ width: mainPaddingLeft }}
      >
        <Sidebar />
      </div>

      {/* Mobile drawer (only renders a trigger/sheet — does not own the
          main content). */}
      <MobileNav />

      {/* Main column — pads to clear the fixed sidebar on desktop, full
          width on mobile. */}
      <div
        style={{ paddingLeft: mainPaddingLeft }}
        className={cn('flex min-h-screen flex-col transition-[padding] duration-300 ease-out')}
      >
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
