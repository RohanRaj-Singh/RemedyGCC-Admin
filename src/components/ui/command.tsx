'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface CommandContextValue {
  search: string;
  setSearch: (s: string) => void;
  // `MutableRefObject` (not `RefObject`): the command input's ref callback
  // writes `current` on mount, which `RefObject`'s readonly `current` rejects.
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

function useCommand() {
  const ctx = React.useContext(CommandContext);
  if (!ctx) throw new Error('Command components must be used inside <Command>');
  return ctx;
}

interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  onSearchChange?: (search: string) => void;
  shouldFilter?: boolean;
}

/**
 * Lightweight command palette container. Built locally to avoid pulling
 * in `cmdk` — we get ~80% of the UX for free with a controlled input
 * + filter prop. Consumers pass pre-filtered children.
 */
const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, children, onSearchChange, ...props }, ref) => {
    const [search, setSearch] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const value = React.useMemo(
      () => ({ search, setSearch, inputRef }),
      [search],
    );
    React.useEffect(() => {
      onSearchChange?.(search);
    }, [search, onSearchChange]);

    return (
      <CommandContext.Provider value={value}>
        <div
          ref={ref}
          className={cn(
            'flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </CommandContext.Provider>
    );
  },
);
Command.displayName = 'Command';

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const { search, setSearch, inputRef } = useCommand();
  return (
    <div className="flex items-center border-b px-4 py-3">
      <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type a command or search…"
        className={cn(
          'flex h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground',
          className,
        )}
        {...props}
      />
    </div>
  );
});
CommandInput.displayName = 'CommandInput';

const CommandList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('max-h-[60vh] overflow-y-auto p-1', className)}
      role="listbox"
      {...props}
    />
  ),
);
CommandList.displayName = 'CommandList';

const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('py-12 text-center text-sm text-muted-foreground', className)}
      {...props}
    >
      No results found.
    </div>
  ),
);
CommandEmpty.displayName = 'CommandEmpty';

const CommandGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('overflow-hidden py-1 [&_[cmdk-group-heading]]:px-2', className)}
      {...props}
    />
  ),
);
CommandGroup.displayName = 'CommandGroup';

function CommandHeading({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

interface CommandItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      role="option"
      aria-selected={active}
      className={cn(
        'flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      {...props}
    />
  ),
);
CommandItem.displayName = 'CommandItem';

const CommandSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('-mx-1 h-px bg-border', className)} {...props} />
  ),
);
CommandSeparator.displayName = 'CommandSeparator';

/**
 * Modal command palette wrapper around Radix Dialog. Renders a centered
 * floating panel with a backdrop that fades on dismiss.
 */
const CommandDialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentProps<typeof DialogPrimitive.Root>
>(({ children, ...props }, ref) => (
  <DialogPrimitive.Root {...props}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        )}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/5 outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        )}
      >
        <Command shouldFilter>{children}</Command>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
));
CommandDialog.displayName = 'CommandDialog';

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandHeading,
  CommandItem,
  CommandSeparator,
  CommandDialog,
  useCommand,
};
