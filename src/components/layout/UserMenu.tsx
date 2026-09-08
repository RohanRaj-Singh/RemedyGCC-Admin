'use client';

import { useAuth } from '@/context/AuthProvider';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAccountMenu } from './Sidebar';
import { UserAvatar, initialsFor } from './primitives';

interface UserMenuProps {
  /** When true, hides the email + role labels (used in tight layouts). */
  compact?: boolean;
}

/**
 * Compact user trigger for the Header. Renders the shared `UserAccountMenu`
 * so the sidebar footer and header open identical dropdowns.
 */
export function UserMenu({ compact = false }: UserMenuProps) {
  const { admin, logout } = useAuth();
  if (!admin) return null;

  const roleLabel = (admin.role ?? '').replace('_', ' ');

  return (
    <UserAccountMenu
      email={admin.email}
      roleLabel={roleLabel}
      initials={initialsFor(admin.email)}
      onSignOut={() => void logout()}
      align="end"
      side="bottom"
    >
      <Button
        variant="ghost"
        size={compact ? 'icon-sm' : 'sm'}
        className="h-9 gap-2 px-1.5 data-[state=open]:bg-accent"
        aria-label="Open user menu"
      >
        <UserAvatar email={admin.email} size="md" />
        {!compact && (
          <>
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold leading-none text-foreground">
                {admin.email}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {roleLabel}
              </p>
            </div>
            <ChevronsUpDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
          </>
        )}
      </Button>
    </UserAccountMenu>
  );
}
