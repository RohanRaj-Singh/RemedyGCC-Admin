'use client';

// ── Financial workflow stepper ──────────────────────────────────────────────
// Shared Claims → Billing → Payments orientation for the Super Admin's
// financial-operations workspace. Placed at the top of all financial pages so
// the admin always knows which stage they are in and where to go next.
//
// Phase B (2026-08-20): The canonical workflow is now expressed as two
// PRIMARY workspaces (Claims, Payments) with Invoices retained as a first-class
// business record accessible via the contextual "Billing" pill here and via
// direct deep links from claim/payment detail pages.
//
// Stage responsibilities (approved canonical workflow — do not redesign):
//   Claims    = eligibility + finance queue (approved claims await billing)
//   Billing   = contextual — generate, issue, mark paid (accessed via direct
//               link /invoices; not a primary workspace)
//   Payments  = payouts to clinics (to_be_paid → paid)
//
// Completed stages are clickable; the current stage is highlighted; the stage
// after current shows a "Next" affordance.

import { FileText, Banknote, ArrowRight, Check, Receipt } from 'lucide-react';

export type WorkflowStage = 'claims' | 'invoices' | 'payments';

const PRIMARY_STAGES: { key: WorkflowStage; label: string; href: string; icon: React.ReactNode; hint: string }[] = [
  { key: 'claims', label: 'Claims & Billing', href: '/reimbursements', icon: <FileText className="h-4 w-4" />, hint: 'Bill approved claims and manage invoices' },
  { key: 'payments', label: 'Payments', href: '/payments', icon: <Banknote className="h-4 w-4" />, hint: 'Payout clinics' },
];

interface WorkflowStepperProps {
  current: WorkflowStage;
}

export default function WorkflowStepper({ current }: WorkflowStepperProps) {
  // Map legacy / canonical stage keys to primary stages. 'invoices' still
  // appears in the type because the /invoices page passes current="invoices"
  // when rendered; in the stepper it is shown as the contextual "Billing"
  // pill, not as one of the two primary stages.
  const currentIndex = PRIMARY_STAGES.findIndex((s) => s.key === current);
  const isOnBillingContext = current === 'invoices';
  const primaryIndex = isOnBillingContext ? PRIMARY_STAGES.length : currentIndex;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <ol className="flex flex-wrap items-center gap-y-2">
        {PRIMARY_STAGES.map((stage, i) => {
          const isDone = i < primaryIndex;
          const isCurrent = i === primaryIndex;
          return (
            <li key={stage.key} className="flex items-center">
              {i > 0 && (
                <ArrowRight className={`mx-2 h-3.5 w-3.5 shrink-0 ${isCurrent || isDone ? 'text-gray-400' : 'text-gray-300'}`} />
              )}
              <a
                href={stage.href}
                title={stage.hint}
                aria-current={isCurrent ? 'step' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
                    : isDone
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  isCurrent ? 'bg-primary text-white' : isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : stage.icon}
                </span>
                {stage.label}
              </a>
            </li>
          );
        })}
        {/* Contextual "Billing" pill — Invoices is a first-class business
            record, but no longer a primary sidebar destination. Rendered as
            a muted pill on the right of the primary stepper. */}
        <li className="ml-auto flex items-center">
          <a
            href="/invoices"
            title="Invoices & A/R — generate, issue, mark paid"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isOnBillingContext
                ? 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Invoices &amp; A/R
            <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${isOnBillingContext ? 'bg-amber-500' : 'bg-gray-400'}`} />
          </a>
        </li>
      </ol>
    </div>
  );
}
