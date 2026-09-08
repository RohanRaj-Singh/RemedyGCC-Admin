'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { LogOut } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandHeading,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { NAV_GROUPS, type NavItem } from './primitives';

interface CommandEntry {
  id: string;
  label: string;
  group: string;
  icon: NavItem['icon'];
  onSelect: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const router = useRouter();
  const { admin, logout } = useAuth();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onCustomEvent() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('remedy:command-palette:open', onCustomEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('remedy:command-palette:open', onCustomEvent);
    };
  }, []);

  const run = React.useCallback(
    (action: () => void) => {
      setOpen(false);
      action();
    },
    [],
  );

  const navigate = React.useCallback(
    (href: string) => () => run(() => router.push(href)),
    [run, router],
  );

  const entries = React.useMemo<CommandEntry[]>(() => {
    const navEntries: CommandEntry[] = NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        id: item.id,
        label: item.label,
        group: group.label,
        icon: item.icon,
        keywords: item.keywords,
        onSelect: navigate(item.href),
      })),
    );
    const accountEntries: CommandEntry[] = admin
      ? [
          {
            id: 'logout',
            label: `Sign out (${admin.email})`,
            group: 'Account',
            icon: LogOut,
            onSelect: () => run(() => void logout()),
            keywords: ['sign out', 'exit'],
          },
        ]
      : [];
    return [...navEntries, ...accountEntries];
  }, [navigate, admin, logout, run]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return Array.from(map.entries());
  }, [entries]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput autoFocus placeholder="Search RemedyGCC…" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {grouped.map(([groupName, items], idx) => (
          <React.Fragment key={groupName}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup>
              <CommandHeading>{groupName}</CommandHeading>
              {items.map((entry) => {
                const Icon = entry.icon;
                return (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.label} ${(entry.keywords ?? []).join(' ')}`}
                    onSelect={entry.onSelect}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{entry.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
