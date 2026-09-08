'use client';

// ── Workflow State — compact 5-stage pipeline (PA4 polish) ──────────────────
// A single horizontal strip showing the five workflow stages with
// counts and amounts. The strip communicates STATE, not ACTION; the
// action surface is the AttentionQueue.
//
// Click any stage to go to the corresponding workspace + filter.
//
// PA4 polish:
//  - Cells are uniform: no ring-1 outline, equal weight, equal padding.
//    The progression (approved → invoiced → awaiting → ready → paid) is
//    shown as a sequence with thin separator dividers between cells, so
//    the eye reads it as a pipeline rather than five isolated cards.
//  - The chevron sits inside the cell so the visual weight matches the
//    row and we don't double-up on the row's pointer affordance.
//  - "Blocked" gets an explicit amber treatment but is not visually
//    alarming — the warning is conveyed by the dot, the label, and the
//    hover state, not by a colored background.

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/format';
import type { DashboardSummary, StageCounts } from '@/lib/dashboard/types';

type StageKey = 'readyForBilling' | 'awaitingOrgPayment' | 'readyToPay' | 'blocked' | 'paidThisMonth';
type Tone = 'neutral' | 'info' | 'success' | 'warning';

interface StageDef {
  key: StageKey;
  label: string;
  href: string;
  tone: Tone;
}

const STAGES: ReadonlyArray<StageDef> = [
  { key: 'readyForBilling', label: 'Ready to bill', href: '/reimbursements?status=approved', tone: 'neutral' },
  { key: 'awaitingOrgPayment', label: 'Awaiting payment', href: '/invoices?status=issued', tone: 'info' },
  { key: 'readyToPay', label: 'Ready to pay', href: '/payments', tone: 'neutral' },
  { key: 'blocked', label: 'Blocked', href: '/payments?tab=blocked', tone: 'warning' },
  { key: 'paidThisMonth', label: 'Paid this month', href: '/invoices?status=paid', tone: 'success' },
];

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-gray-400',
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

interface WorkflowStateProps {
  summary: DashboardSummary;
}

function StageCell({ stage, counts }: { stage: StageDef; counts: StageCounts }) {
  return (
    <Link
      href={stage.href}
      className="group flex min-w-0 flex-col gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3.5 transition-colors duration-150 hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[stage.tone]}`} aria-hidden="true" />
        <span className="truncate text-xs font-medium text-gray-600">{stage.label}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums leading-none text-gray-900">{counts.count}</span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-colors duration-150 group-hover:text-gray-600"
          aria-hidden="true"
        />
      </div>
      <span className="truncate text-xs tabular-nums text-gray-500">{formatCurrency(counts.amount)}</span>
    </Link>
  );
}

export default function WorkflowState({ summary }: WorkflowStateProps) {
  const w = summary.workflow;
  return (
    <section aria-labelledby="workflow-heading" className="flex flex-col gap-3">
      <h2 id="workflow-heading" className="text-sm font-semibold text-gray-900">
        Financial workflow
      </h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((stage) => (
          <StageCell key={stage.key} stage={stage} counts={w[stage.key]} />
        ))}
      </div>
    </section>
  );
}
