# Claims → Invoice Business Workflow — Implementation

**Date:** 2026-08-26
**Phase:** 2 (implement the locked business workflow from `claims-invoice-business-workflow-spec.md`)
**Status:** Implemented + verified (typecheck clean, tests green)

## 1. Overview

This phase implemented the Claims → Invoice business workflow end-to-end, replacing the
previous date-range-driven invoice generation with an **explicit claim-selection** model.
One invoice = one organization = many claims = many clinics. Eligibility is determined by
claim identity and status alone — never by `serviceDate` or `createdAt`.

The authoritative design decisions (D1–D14) were locked in
`claims-invoice-business-workflow-spec.md`. This document records what changed in code and
why, and what was intentionally deferred.

## 2. Finalized Workflow

```
Claims (approved)
  → Select Organization
  → Identify eligible claims (approved AND not yet invoiced)
  → Explicitly select claims
  → Generate Draft Invoice (line-item snapshot)
  → Review Draft
  → Issue Invoice (status: issued)
  → Organization pays externally
  → Super Admin records Organization Payment
  → Invoice becomes Paid
  → Linked approved claims become TO_BE_PAID
  → Payments workspace handles payout
```

## 3. Business Rules

### 3.1 Eligibility (authoritative)

A claim is eligible for invoicing **only** when ALL of the following hold:

1. The claim exists.
2. `claim.tenantId === invoice.tenantId` (no mixed organizations).
3. `claim.status === "approved"`.
4. The claim is not already referenced by any invoice line item — across
   `draft` / `issued` / `paid` / `archived` invoices.

`serviceDate` and `createdAt` **never** gate eligibility. Date ranges do **not**
auto-select claims.

### 3.2 Atomic validation

Every selected claim is validated before anything is written. If any claim is invalid,
**nothing is created** and the call fails with `ApiError(400, "INVALID_CLAIMS", …)` whose
`details` carries:

```ts
{
  rejected: Array<{ claimId: string; reason: string }>,
  validClaimIds: string[],
}
```

Empty selection → `NO_CLAIMS_SELECTED`. Missing tenant → `MISSING_TENANT`.

### 3.3 Billing period

`period` is **derived** from the selected claims' `serviceDate` (earliest → latest).
Fallback is `{ from: "", to: "" }` when no selected claim carries a service date.

### 3.4 Invoice lifecycle (with `generated` retirement)

```
draft → issued → paid → archived
```

The dead `generated` status was removed from the `InvoiceStatus` type. `issueInvoice`
still accepts `generated` as a *legacy source status* for defensive normalization of any
pre-existing record, but nothing produces it anymore.

### 3.5 Payment → payout

Only an **organization payment** (invoice `issued → paid`) causes linked approved claims to
enter the payout queue (`approved → to_be_paid`). Invoice generation alone does **not** move
claims. This preserves Accounts Receivable accuracy: an issued-but-unpaid invoice is an
asset, not a payout obligation.

## 4. API Changes

### 4.1 `generateInvoice` — signature change (BREAKING)

```ts
// Before
generateInvoice({ tenantId, from, to, generatedBy })

// After
generateInvoice({ tenantId, claimIds, generatedBy })
```

- `tenantapp/app/api/invoices/generate/route.ts` now accepts `{ tenantId, claimIds }`.
- The admin proxy (`remedygcc-admin/src/app/api/super-admin/invoices/generate/route.ts`)
  forwards the body verbatim; only its doc comment changed.

### 4.2 Claim → Invoice relationship (read-time join)

New service helper `getClaimInvoiceLinks(claimIds)` returns
`Map<claimId, { invoiceId, invoiceNumber, status }>` derived from invoice line items — no
claim-side mutation, no `claim.status = "invoiced"`.

The admin claims list and detail endpoints now expose:

```ts
{ invoiceId: string | null, invoiceNumber: string | null, invoiceStatus: string | null }
```

on every claim payload (null when not yet invoiced).

## 5. Repository Changes

- `InvoicesRepositoryContract` — added `findByClaimIds(claimIds): Promise<InvoiceDocument[]>`.
- Mongo `InvoicesRepository` — implemented `findByClaimIds` via
  `{ "lineItems.claimId": { $in: claimIds } }`; added index `invoice_lineitems_claimid`.
- `MemoryInvoicesRepository` — implemented `findByClaimIds` via a linear scan.

## 6. Schema / Document Changes

- `InvoiceStatus` — removed `"generated"` → `"draft" | "issued" | "paid" | "archived"`.
- **No** claim status enum changes; **no** `"invoiced"` claim status added; **no**
  UI-only fields added. The claim ↔ invoice relationship is fully derived at read time.

## 7. Frontend Changes (minimal)

- `invoices/page.tsx`
  - Removed the `generated` status from the `ArStatus` type and `AR_STATUS_CONFIG`.
  - Replaced the Generate modal's `from`/`to` date inputs with an **explicit claim
    multi-select** (fetches approved claims for the org, disables already-invoiced ones,
    shows a running total, "Select all eligible" / "Clear").
  - `handleGenerate` now POSTs `{ tenantId, claimIds }`.
  - Removed `generated` from the issue/archive action gating.
- `invoices/[id]/page.tsx` — removed `generated` from the status type, `STATUS_CONFIG`,
  `canArchive`, and `canIssue`.
- `components/financial/PrintableInvoice.tsx` — removed `generated` from `STATUS_LABEL`;
  changed the "MATCHED BY / Service date within period" label to
  "SELECTION / Explicitly selected claims" (period is now derived, not input).

## 8. Traceability

The claim ↔ invoice relationship is preserved across the full lifecycle:

- **Claim → Invoice:** via `getClaimInvoiceLinks` (derived from line items) — accurate for
  draft / issued / paid / archived invoices.
- **Invoice → Claims:** line items (unchanged).
- **Payment → Claim, Payment → Invoice, Claim → Payment, Invoice → OrgPayment:** unchanged.

## 9. Tests

`tenantapp/src/server/services/__tests__/invoice.test.ts` was rewritten against the new
claim-selection API and now covers:

- consolidated invoice (Σ selected amounts)
- billing period derivation from service dates
- atomic rejection of non-approved claims (`INVALID_CLAIMS` with `details.rejected`/`validClaimIds`)
- `sessionCount` is informational only
- double-invoicing guard
- wrong-organization rejection
- empty selection (`NO_CLAIMS_SELECTED`) and missing tenant (`MISSING_TENANT`)
- date independence (ancient + future service dates both eligible when selected)
- lifecycle `draft → issued → paid`
- invalid lifecycle transitions
- CSV export
- financial flow (generation does not move claims; payment does)
- claim → invoice traceability via `getClaimInvoiceLinks` across the lifecycle
- A/R ledger outstanding/cleared
- archive terminal state
- tenant/super-admin scoping

`payment.test.ts` was updated to the new `generateInvoice` signature (single call site).

## 10. Verification

- `npm run typecheck` (tenantapp) — clean.
- `npx tsc --noEmit` (remedygcc-admin) — clean.
- `npm test` (tenantapp) — **261 passed, 0 failed**.

## 11. Deferred

- **Structured rejection surfacing in the UI** — the Generate modal shows the summary error
  message; the per-claim `details.rejected` list is available via the API but not yet
  rendered (the modal already disables already-invoiced claims, so rejections are a race
  edge case only).
- **Legacy `generated` record migration** — `issueInvoice` normalizes defensively; no
  one-off data migration was run because nothing in production ever wrote `generated`.
- **Claims-list UI surfacing the invoice relationship** — the fields are returned by the
  API but the claims table does not yet render them (part of the future visual pass).
- **Visual/perf/UX modernization** — explicitly out of scope for this phase.
