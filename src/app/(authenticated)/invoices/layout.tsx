// PA2-A item 3: Sidebar + main wrapper live in (authenticated)/layout.tsx so
// they persist across workspace nav. This layout is now a bare pass-through.
'use client';

import type { ReactNode } from 'react';

export default function InvoicesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}