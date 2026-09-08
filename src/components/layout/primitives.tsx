'use client';

import {
  LayoutDashboard,
  Receipt,
  Wallet,
  MessageSquare,
  Building2,
  Heart,
  Users,
  Scan,
  FileStack,
  FileText,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** Single source of truth for sidebar nav + command palette entries. */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspaces',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
      {
        id: 'reimbursements',
        label: 'Claims & Billing',
        icon: Receipt,
        href: '/reimbursements',
        keywords: ['claims', 'billing', 'invoices'],
      },
      { id: 'payments', label: 'Payments', icon: Wallet, href: '/payments' },
      {
        id: 'requests',
        label: 'Requests',
        icon: MessageSquare,
        href: '/requests',
        keywords: ['approvals', 'review'],
      },
    ],
  },
  {
    label: 'Entities',
    items: [
      { id: 'tenants', label: 'Tenants', icon: Building2, href: '/tenants' },
      { id: 'clinics', label: 'Clinics', icon: Heart, href: '/clinics' },
      { id: 'employees', label: 'Employees', icon: Users, href: '/employees' },
      { id: 'scanners', label: 'Scanners', icon: Scan, href: '/scanners' },
    ],
  },
  {
    label: 'System',
    items: [
      {
        id: 'attribute-templates',
        label: 'Attribute Templates',
        icon: FileStack,
        href: '/attribute-templates',
      },
      { id: 'logs', label: 'System Logs', icon: FileText, href: '/logs' },
      { id: 'settings', label: 'Settings', icon: Settings, href: '/settings', keywords: ['preferences', 'config'] },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Resolve the active nav item from the current pathname. The dashboard item
 * (`href === '/'`) is matched exactly to avoid highlighting it on every
 * nested route.
 */
export function resolveActiveNav(pathname: string | null): NavItem | undefined {
  if (!pathname) return undefined;
  return ALL_NAV_ITEMS.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  );
}

/**
 * Build a breadcrumb trail from the current pathname. Walks each segment and
 * matches against the nav groups. Falls back to a pretty-formatted segment.
 */
export function buildBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [{ label: 'Home', href: '/' }];
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return crumbs;

  // Try to match the longest prefix against a known nav item.
  let matchedNav: NavItem | undefined;
  let matchedGroup: NavGroup | undefined;
  for (let depth = segments.length; depth > 0; depth -= 1) {
    const candidate = '/' + segments.slice(0, depth).join('/');
    const item = ALL_NAV_ITEMS.find((n) => n.href === candidate);
    if (item) {
      matchedNav = item;
      matchedGroup = NAV_GROUPS.find((g) => g.items.includes(item));
      crumbs.push({ label: matchedGroup?.label ?? '', href: matchedNav.href });
      // Remaining segments are treated as sub-routes.
      for (let i = depth; i < segments.length; i += 1) {
        const href = '/' + segments.slice(0, i + 1).join('/');
        crumbs.push({ label: prettifySegment(segments[i]!), href });
      }
      return crumbs.filter((c) => c.label);
    }
  }

  // No nav match — just push the segments.
  for (let i = 0; i < segments.length; i += 1) {
    const href = '/' + segments.slice(0, i + 1).join('/');
    crumbs.push({ label: prettifySegment(segments[i]!), href });
  }
  return crumbs.filter((c) => c.label);
}

function prettifySegment(segment: string): string {
  // Replace UUIDs / hex ids with a short marker.
  if (/^[a-f0-9-]{16,}$/i.test(segment)) return 'Detail';
  // Replace dashes with spaces and title-case.
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Compute initials for an avatar fallback. Handles emails ("john@…" → "JO"),
 * single words, and multi-word labels.
 */
export function initialsFor(label: string | null | undefined): string {
  if (!label) return '?';
  const trimmed = label.trim();
  if (!trimmed) return '?';
  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0] ?? '';
    return (local.slice(0, 2) || '?').toUpperCase();
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface BrandMarkProps {
  size?: 'sm' | 'md';
  /** When true, show only the icon (no text). */
  iconOnly?: boolean;
  /** Override the brand name (used by Header when sidebar is also showing the brand). */
  showLabel?: boolean;
  className?: string;
}

/**
 * Renders the brand block (logo or initial square + name + subtitle).
 * Used by Header AND Sidebar so they always look identical.
 */
export function BrandMark(props: BrandMarkProps) {
  const size = props.size ?? 'md';
  const iconOnly = props.iconOnly ?? false;
  const showLabel = props.showLabel ?? true;
  const className = props.className;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <BrandIcon size={size} />
      {showLabel && !iconOnly && <BrandLabel />}
    </div>
  );
}

function BrandIcon({ size }: { size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-lg bg-primary font-bold text-primary-foreground shadow-sm ring-1 ring-primary/20',
        dim,
      )}
      aria-hidden="true"
    >
      R
    </div>
  );
}

function BrandLabel() {
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-sm font-semibold text-foreground">RemedyGCC</p>
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Super Admin
      </p>
    </div>
  );
}

interface UserAvatarProps {
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Renders the user's avatar with initials fallback. Single source of truth
 * for the avatar's visual treatment (primary color, ring, font size).
 */
export function UserAvatar({ email, size = 'md', className }: UserAvatarProps) {
  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-[11px]';
  return (
    <Avatar className={cn('shrink-0 ring-1 ring-border', dim, className)}>
      <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
        {initialsFor(email)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Re-export LogOut so consumers don't need to import from lucide separately. */
export { LogOut };
