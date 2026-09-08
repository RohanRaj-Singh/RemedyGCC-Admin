'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  LogOut,
  Settings,
  User as UserIcon,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLayout } from './LayoutContext';
import {
  BrandMark,
  NAV_GROUPS,
  UserAvatar,
  initialsFor,
  resolveActiveNav,
} from './primitives';

interface SidebarProps {
  /** Override the active item id (used by pages that embed a sub-sidebar). */
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /** When true, the sidebar is rendered as a fixed drawer (mobile). */
  asDrawer?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({
  activeTab: forcedActiveTab,
  onTabChange,
  asDrawer = false,
  onNavigate,
}: SidebarProps) {
  const { sidebarCollapsed, setMobileNavOpen } = useLayout();
  const pathname = usePathname();
  const { admin, logout } = useAuth();

  const activeId = forcedActiveTab ?? resolveActiveNav(pathname ?? null)?.id;

  const widthClass = sidebarCollapsed ? 'w-[4.25rem]' : 'w-64';
  const roleLabel = (admin?.role ?? '').replace('_', ' ');
  const initials = initialsFor(admin?.email);

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        data-collapsed={sidebarCollapsed}
        data-drawer={asDrawer}
        className={cn(
          'flex h-full flex-col border-r bg-card transition-[width] duration-300 ease-out',
          widthClass,
          asDrawer && 'shadow-xl',
        )}
      >
        {/* Brand — single source of truth. The collapse toggle lives in
            the Header (single source) — never here, to avoid the duplicate
            button bug. */}
        <div
          className={cn(
            'flex h-16 items-center gap-2 border-b border-border px-3',
            sidebarCollapsed && 'justify-center px-2',
          )}
        >
          <BrandMark size="md" iconOnly={sidebarCollapsed} showLabel={!sidebarCollapsed} />
          {asDrawer && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="ml-auto"
            >
              <ChevronLeft />
            </Button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map((group, idx) => (
            <div key={group.label} className={cn(idx > 0 && 'mt-4')}>
              {!sidebarCollapsed && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeId === item.id;
                  const link = (
                    <Link
                      href={item.href}
                      onClick={() => {
                        onTabChange?.(item.id);
                        onNavigate?.();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                  if (!sidebarCollapsed) return <li key={item.id}>{link}</li>;
                  return (
                    <li key={item.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer — user card + logout. Always present, regardless of
            collapsed state. The whole card is the account trigger; logout
            gets its own visible button on the right when expanded. */}
        {admin && (
          <div
            className={cn(
              'border-t border-border p-2',
              asDrawer && 'pb-3',
            )}
          >
            <UserFooter
              email={admin.email}
              roleLabel={roleLabel}
              initials={initials}
              collapsed={sidebarCollapsed}
              asDrawer={asDrawer}
              onSignOut={() => void logout()}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------------ */
/*                          Sidebar user footer                              */
/* ------------------------------------------------------------------------ */

interface UserFooterProps {
  email: string;
  roleLabel: string;
  initials: string;
  collapsed: boolean;
  asDrawer: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
}

/**
 * Prominent user card pinned to the bottom of the sidebar.
 *
 * - Expanded: avatar + email + role chip + visible "Sign out" button.
 * - Collapsed: avatar becomes a DropdownMenu trigger with Profile / Settings
 *   / Sign out.
 * - Drawer (mobile): same as expanded but no collapse consideration.
 */
function UserFooter({
  email,
  roleLabel,
  initials,
  collapsed,
  asDrawer,
  onSignOut,
  onNavigate,
}: UserFooterProps) {
  // Collapsed — the avatar itself is a DropdownMenu trigger.
  if (collapsed && !asDrawer) {
    return (
      <div className="flex flex-col items-center gap-2">
        <UserAccountMenu
          email={email}
          roleLabel={roleLabel}
          initials={initials}
          onSignOut={onSignOut}
          align="end"
          side="right"
        >
          <button
            type="button"
            aria-label={`Account menu for ${email}`}
            className="rounded-full ring-2 ring-transparent transition-all hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-primary"
          >
            <UserAvatar email={email} size="md" />
          </button>
        </UserAccountMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onSignOut}
              aria-label="Sign out"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Expanded (or drawer) — show the full card.
  return (
    <UserAccountMenu
      email={email}
      roleLabel={roleLabel}
      initials={initials}
      onSignOut={onSignOut}
      align="start"
      side="top"
    >
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors',
          'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
        )}
      >
        <UserAvatar email={email} size="md" />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-semibold text-foreground"
            title={email}
          >
            {email}
          </p>
          <Badge variant="secondary" className="mt-0.5">
            {roleLabel || 'User'}
          </Badge>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSignOut();
              }}
              aria-label="Sign out"
              className="text-muted-foreground opacity-70 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <LogOut />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </UserAccountMenu>
  );
}

interface UserAccountMenuProps {
  email: string;
  roleLabel: string;
  initials: string;
  onSignOut: () => void;
  align?: 'start' | 'end' | 'center';
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
}

/**
 * Reusable account menu — used by both the sidebar user card and the
 * header user menu (when triggered from the avatar).
 */
export function UserAccountMenu({
  email,
  roleLabel,
  initials,
  onSignOut,
  align = 'end',
  side = 'bottom',
  children,
}: UserAccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={8}
        className="min-w-[16rem] p-0"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3 px-1 py-1">
            <UserAvatar email={email} size="lg" className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground" title={email}>
                {email}
              </p>
              <Badge variant="secondary" className="mt-1">
                {roleLabel || 'User'}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => (window.location.href = '/settings')}>
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => (window.location.href = '/settings')}>
            <Settings />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onSignOut}
          className="text-destructive focus:text-destructive data-[highlighted]:text-destructive"
        >
          <LogOut />
          Sign out
          <span className="ml-auto inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘Q
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Suppress unused warning for helper retained for callers that still use it.
export const _initialsFor = initialsFor;
// Keep the divider icon exported for future use.
export { ChevronsUpDown as _ChevronsUpDown };
