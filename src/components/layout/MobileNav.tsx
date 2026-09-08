'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { useLayout } from './LayoutContext';

export function MobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useLayout();
  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <Sidebar
          asDrawer
          onNavigate={() => setMobileNavOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
