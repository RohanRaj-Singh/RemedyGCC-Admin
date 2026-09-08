'use client';

import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { UserMenu } from './UserMenu';
import { StatusPill } from './StatusPill';
import { Breadcrumbs } from './Breadcrumbs';
import { BrandMark } from './primitives';
import { useLayout } from './LayoutContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Application chrome — single 64px row above every authenticated page.
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ [≡] [R] Brand │       ⌘K Search Bar        │ Live │ 🔔 │ 👤  │
 *   ├────────────────────────────────────────────────────────────────┤
 *   │ Home › Workspaces › Claims & Billing                            │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Notes:
 *  - The collapse toggle is the SINGLE source of truth for sidebar state
 *    (the sidebar no longer has its own collapse button).
 *  - The brand block is hidden when the sidebar is open & visible; it
 *    appears as a compact "R" + wordmark when the sidebar collapses or on
 *    mobile. This eliminates the duplicate brand the previous design had.
 *  - CommandPalette is mounted at the layout level (see `app/(authenticated)
 *    /layout.tsx`) so its key listener + ⌘K custom event stay alive across
 *    page navigations.
 */
export function Header() {
  const { sidebarCollapsed, toggleSidebarCollapsed, setMobileNavOpen } = useLayout();

  return (
    <header
      className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-xl"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Row 1: chrome */}
      <div className="flex h-16 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        {/* Left zone: mobile menu + sidebar toggle + (conditional) brand */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden"
            aria-label="Open navigation"
          >
            <Menu />
          </Button>

          {/* Single sidebar-collapse toggle (the only one). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleSidebarCollapsed}
                className="hidden md:inline-flex"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sidebarCollapsed ? 'Expand' : 'Collapse'} sidebar
              <kbd className="ml-2 rounded border border-border/30 bg-background/20 px-1 font-mono text-[10px]">
                ⌘B
              </kbd>
            </TooltipContent>
          </Tooltip>

          {/* Brand wordmark — only when the sidebar is collapsed (otherwise
              it would duplicate the larger brand in the sidebar). Hidden
              completely on mobile (the brand is in the sidebar header
              when the drawer opens). */}
          <div
            className={cn(
              'min-w-0 items-center transition-opacity duration-150',
              sidebarCollapsed ? 'hidden md:flex' : 'hidden',
            )}
          >
            <BrandMark size="md" iconOnly={false} showLabel />
          </div>
        </div>

        {/* Center zone: command palette trigger */}
        <div className="flex flex-1 justify-center px-1 sm:px-4">
          <CommandPaletteTrigger />
        </div>

        {/* Right zone: status + notifications + user */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <StatusPill />
          <NotificationBell />
          <UserMenu compact />
        </div>
      </div>

      {/* Row 2: breadcrumbs — slim, low-profile. */}
      <div
        className="hidden h-9 items-center border-t px-4 sm:flex sm:px-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <Breadcrumbs />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------ */
/*                              Search trigger                                */
/* ------------------------------------------------------------------------ */

function CommandPaletteTrigger() {
  function open() {
    window.dispatchEvent(new CustomEvent('remedy:command-palette:open'));
  }
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'inline-flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 text-sm text-muted-foreground transition-colors',
        'hover:bg-secondary hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate text-left">Search or jump to…</span>
      <kbd className="hidden items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground sm:inline-flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
