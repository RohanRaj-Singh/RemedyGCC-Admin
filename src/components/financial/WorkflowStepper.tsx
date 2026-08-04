'use client';

// ── Financial workflow stepper ──────────────────────────────────────────────
// Shared Claims → Invoices → Payments orientation for the Super Admin's
// financial-operations workspace. Placed at the top of all three pages so the
// admin always knows which stage they are in and where to go next.
//
// Stage responsibilities (approved canonical workflow — do not redesign):
//   Claims    = eligibility + finance queue (approved claims await billing)
//   Invoices  = billing (selection + generation, company pays Remedy)
//   Payments  = payouts to clinics (to_be_paid → paid)
//
// Completed stages are clickable; the current stage is highlighted; the stage
// after current shows a "Next" affordance.

import { FileText, Receipt, Banknote, ArrowRight, Check } from 'lucide-react';

export type WorkflowStage = 'claims' | 'invoices' | 'payments';

const STAGES: { key: WorkflowStage; label: string; href: string; icon: React.ReactNode; hint: string }[] = [
  { key: 'claims', label: 'Claims', href: '/reimbursements', icon: <FileText className="h-4 w-4" />, hint: 'Approved claims await billing' },
  { key: 'invoices', label: 'Invoices', href: '/invoices', icon: <Receipt className="h-4 w-4" />, hint: 'Bill the organization' },
  { key: 'payments', label: 'Payments', href: '/payments', icon: <Banknote className="h-4 w-4" />, hint: 'Payout clinics' },
];

interface WorkflowStepperProps {
  current: WorkflowStage;
}

export default function WorkflowStepper({ current }: WorkflowStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === current);
  const nextStage = STAGES[currentIndex + 1];

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <ol className="flex flex-wrap items-center gap-y-2">
        {STAGES.map((stage, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
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
      </ol>
      {nextStage && (
        <a
          href={nextStage.href}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
        >
          Next: {nextStage.label}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
