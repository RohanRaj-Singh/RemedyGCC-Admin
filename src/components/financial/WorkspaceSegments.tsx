'use client';

// ── Workspace segments ──────────────────────────────────────────────────────
// Expresses the "Claims & Billing" workspace as ONE place with two facets:
//   · Bill claims      — select approved claims → generate invoice
//   · Invoices & A/R   — review / issue / organization payment / receivable
// Rendered at the top of both /reimbursements and /invoices so the operator
// reads them as a single workspace, not two disconnected tools. Routes are
// preserved (deep links keep working); only the framing changes.

import Link from 'next/link';
import { FileText, Receipt } from 'lucide-react';

export type BillingSegment = 'billing' | 'invoices';

const SEGMENTS: { key: BillingSegment; label: string; href: string; icon: typeof FileText }[] = [
  { key: 'billing', label: 'Bill claims', href: '/reimbursements', icon: FileText },
  { key: 'invoices', label: 'Invoices & A/R', href: '/invoices', icon: Receipt },
];

export default function WorkspaceSegments({ active }: { active: BillingSegment }) {
  return (
    <div
      className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1"
      role="tablist"
      aria-label="Claims & Billing workspace"
    >
      {SEGMENTS.map((seg) => {
        const isActive = active === seg.key;
        const Icon = seg.icon;
        return (
          <Link
            key={seg.key}
            href={seg.href}
            role="tab"
            aria-selected={isActive}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {seg.label}
          </Link>
        );
      })}
    </div>
  );
}
