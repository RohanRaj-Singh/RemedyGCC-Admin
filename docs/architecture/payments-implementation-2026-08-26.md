# Payments Workflow + UI/UX Rebuild — Implementation

**Date:** 2026-08-26
**Phase:** 4 (rebuild the Super Admin Payments presentation layer around a claim-centered workspace)
**Status:** Implemented + verified (typecheck clean, tests green)

## 1. Overview

This phase rebuilt the Super Admin Payments workspace from the previous
organization → clinic → claim drill-down into a **claim/payment-centered** workspace with
three primary views: **Ready to Pay · Blocked · Paid (History)**.

The actionable unit is the **claim**. Organization and clinic are context, filters, and
grouping — never the unit of action. This matches the client's described workflow: an
approved claim enters the queue (`to_be_paid`) when its organization pays Remedy, the
finance operator reviews each claim, the bank transfer happens externally, and the
operator **records** the payment here, moving the claim `to_be_paid → paid`.

The authoritative design decisions were locked in
`payments-business-workflow-spec-2026-08-26.md`. This document records what changed in
code and why, and what was intentionally deferred.

## 2. Finalized Workflow

```
Approved claim
  → Organization pays Remedy (invoice issued → paid)
  → markInvoicePaid auto-queues the linked approved claim (approved → to_be_paid)
  → Payment workspace: READY (bank on claim) vs BLOCKED (no bank on claim)
  → Operator reviews READY claim → bank transfer happens externally
  → Operator records payment (PaymentRecordDialog)
  → processPayments: to_be_paid → paid, PaymentRecord finalized
  → Claim appears in PAID (history)
```

There is **no** manual "Queue Payment" action. A claim reaches `to_be_paid` only through
invoice settlement (`markInvoicePaid`).

## 3. Business Rules (authoritative)

### 3.1 Readiness

A claim is **READY to pay** when both hold:

1. `claim.status === "to_be_paid"` (the queue only surfaces `to_be_paid` claims).
2. The claim's own bank snapshot is complete (`bankAccountNumber` **and** `bankName`).

A `to_be_paid` claim without a complete claim bank snapshot is **BLOCKED**, surfaced with
the reason *"Missing bank details on claim"*.

### 3.2 Bank source — claim only

The claim's immutable bank snapshot is the **sole** source of truth for payout. The
previous employee-profile fallback was removed. A claim without its own bank snapshot is
blocked and is **never** silently funded from another source (e.g. the live employee
profile).

### 3.3 Payment recording (do not bypass PaymentRecord)

Recording a payment:

1. Finalizes the claim transition `to_be_paid → paid` via the state machine.
2. Finalizes the `PaymentRecord` ledger entry with `status: "paid"`, `paidAt` (server
   timestamp), `paidBy`, and the operator-entered fields: `paymentDate` (the actual
   transfer date — **not** forced to today), `method`, `bankReference` (optional), and
   `notes` (optional).
3. Preserves the funding invoice linkage on the record.

The `PaymentRecord` is never bypassed — every paid claim has a finalized ledger entry.

### 3.4 Duplicate-payment protection

The recording dialog surfaces a **strong warning** (not a silent block) when any claim id
repeats in the selection, or any selected claim already has a paid ledger record. The
operator may still "Continue Anyway".

## 4. Backend Changes (`tenantapp`)

### 4.1 `PaymentRecordDocument` — `paymentDate`

`src/server/db/documents.ts` gained `paymentDate?: string` on `PaymentRecordDocument`
(operator-entered transfer date; falls back to `paidAt` in the UI when absent).

### 4.2 `processPayments` — `paymentDate` + `method`

`src/server/services/paymentService.ts`:

- `processPayments` options gained `paymentDate?` and `method?`; both are persisted on the
  `update` and `insert` branches via `...(paymentDate !== undefined ? { paymentDate } : {})`
  and `...(method !== undefined ? { method } : {})`.

### 4.3 Workspace — claim-bank-only, no overdue

- `PaymentWorkspaceClaim.bankSource` narrowed to `"claim" | "missing"` (removed
  `"employee_fallback"`).
- `PaymentWorkspaceResult.summary` removed `overdue` — now `outstanding` + `paidToday`.
  The 14-day "overdue" concept was an invented payout-queue notion, not A/R; aging is now
  client-side via `daysQueued(queuedAt)` for display only.
- Replaced the employee-profile fallback resolution (which had O(n²)
  `queue.reimbursements.find` scans) with a single claim-only pass.
- `PaymentWorkspaceHistoryEntry` gained `paymentDate?` and `method?`; history pushes now
  include both.

### 4.4 Process route

`app/api/admin/payments/process/route.ts` now extracts `paymentDate` and `method` from the
body and passes them to `processPayments` (same trim/undefined pattern as `bankReference`
and `notes`).

### 4.5 Divergent routes removed

Four divergent payout/queue routes were deleted (verified unreferenced before removal):

- `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/pay/route.ts`
- `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/queue-payment/route.ts`
- `tenantapp/app/api/reimbursements/[id]/pay/route.ts`
- `tenantapp/app/api/reimbursements/[id]/queue-payment/route.ts`

The canonical path is: Payments workspace → Record Payment → PaymentRecord → claim paid.

## 5. Pure-Logic Module (`remedygcc-admin`)

`src/lib/financial/payout.ts` — a new framework-free module that maps the verified backend
payload onto the claim-centered Ready/Blocked/Paid model. It owns:

- `flattenQueue` — org → clinic → claim into a flat claim list with org/clinic context.
- `isPayoutReady` / `classifyPayout` / `blockReason` — readiness gate + block reason.
- `summarizePayouts` — ready vs blocked counts/amounts.
- `groupByClinic` — clinic-grouped view with totals + stable sorting.
- `findDuplicateClaimIds` / `findAlreadyPaid` — duplicate-payment protection.
- `buildPaymentPayload` — recording payload (omits blank fields).
- `filterPayoutClaims` — free-text + org-scope filtering.
- `daysQueued` — whole-days aging.
- `buildPayoutCsv` / `buildHistoryCsv` — CSV export.

## 6. Frontend Changes (`remedygcc-admin`)

### 6.1 `app/payments/page.tsx` — rebuilt

Replaced the org → clinic → claim drill-down with a tabbed workspace:

- **Ready to Pay** — flat claim table or clinic-grouped view (toggle), with per-claim
  "Record" and a bulk "Record N Payments" action.
- **Blocked** — flat/grouped list of missing-bank claims with the block reason.
- **Paid (History)** — reconciliation table (payment ref, claim, invoice, org, clinic,
  amount, paid date, method, paid by) with CSV export.
- Summary cards (Ready / Blocked / Paid Today / Outstanding), client-side search + org
  filter, localized skeletons, and meaningful empty/error/success states.

### 6.2 `components/financial/PaymentRecordDialog.tsx` — rebuilt

Now shows employee, organization, clinic, claim, invoice, amount, bank, and service date
per claim, and captures **payment date** (actual transfer date), **method**, **bank/transfer
reference**, and **notes**. Includes the duplicate-payment warning with a "Continue Anyway"
override.

### 6.3 `app/payments/[claimId]/page.tsx` — rebuilt

Replaced the full-page spinner with a localized skeleton; added `paymentDate`/`method` to
the `PaymentRecord` model; error state uses the shared empty state.

### 6.4 `components/financial/PrintablePayment.tsx`

Added `paymentDate` and `method` to the printable advice; "Paid Date" now prefers the
operator-entered `paymentDate` over `paidAt`.

## 7. Traceability

- **Payment → Claim** — `PaymentRecord.claimId` (unique index; one ledger entry per claim).
- **Payment → Invoice** — `PaymentRecord.invoiceId` (set when auto-queued by
  `markInvoicePaid`), surfaced in the dialog and history.
- **Claim → Payment** — the claim status machine (`to_be_paid → paid`) plus the finalized
  `PaymentRecord`; both the history table and detail page link claim ↔ payment.

## 8. Tests

- `remedygcc-admin/src/lib/financial/tests/payout.test.ts` (new) — 13 tests covering
  flatten, readiness/block, summarize, group-by-clinic, dedupe, already-paid, payload
  building, filtering, aging, and both CSV builders.
- `tenantapp/src/server/services/__tests__/payment.test.ts` (updated) — the former
  "employee-profile fallback" test now asserts **no silent fallback** (`bankSource ===
  "missing"`), and a new test verifies the operator-entered `paymentDate` and `method` are
  recorded on the ledger.

## 9. Verification

- `npx tsc --noEmit` (remedygcc-admin) — clean.
- `npx tsc --noEmit` (tenantapp) — clean (stale `.next/types/validator.ts` references to the
  deleted routes were cleared).
- `tsx --test` (remedygcc-admin) — **55 passed, 0 failed**.
- `tsx --test` (tenantapp) — **262 passed, 0 failed**.

## 10. Deferred / Explicitly Out of Scope

Per the phase's hard stop:

- **No** payment-batch domain, partial-payment infrastructure, reversal/adjustment system,
  or additional payment states.
- **No** redesign of the Claims or Invoices workflows — the verified Claims → Invoice flow
  is untouched except where the Payments dependency required it (invoice → `to_be_paid`
  queueing is pre-existing and unchanged).
- **No** `"invoiced"` claim status — invoice linkage remains a read-time join.
- **No** caching or global redesign.
- Next phase: cross-workspace financial workflow verification.
