# Claims + Invoice UI/UX Rebuild — Phase 3

**Date:** 2026-08-26
**Scope:** Super Admin financial workflow — Claims and Invoice surfaces only.
**Backend:** Frozen (verified 2026-08-20). No backend changes in this phase.

This phase rebuilt the Super Admin **Claims** and **Invoices** experiences on top of
the verified backend, around one mental model the operator always follows:

> **I choose the organization → choose the claims to bill → generate the invoice →
> review it → issue it → understand what happens next.**

---

## REBUILT

### Claims page (`src/app/reimbursements/page.tsx`)
- **Organization-first.** A prominent org selector scopes the page; selecting an org
  loads the table and the org's "ready for invoicing" set.
- **Two, not three, entry points to generation.** A "Ready for invoicing" next-action
  banner and the selection toolbar both open the *same* shared `GenerateInvoiceDialog`.
- **Persistent shortlist.** Checkbox selection is a `Map<claimId, amount>` that survives
  filter/pagination changes and drives an inline toolbar (`N claims shortlisted · OMR X`).
- **Eligibility as a derived column.** A `BillingEligibilityBadge` shows where each claim
  sits in the workflow (ready / on draft / awaiting payment / invoice paid / paid / …)
  and links to the funding invoice when one exists.
- **Loading, empty, error, and success states** via shared components — no full-page
  spinners, no layout shift.

### Invoices page (`src/app/invoices/page.tsx`)
- **Two-tab layout:** a flat, filterable **Invoices** history list and an org-first
  **A/R Ledger**.
- **Generation moved off this page.** The single primary CTA is "Start billing", which
  links to the Claims page. Invoice history is now purely a record + A/R surface.
- **Context-before-confirmation** on issue / mark-paid / archive, via `ConfirmActionDialog`.
  Each action states the invoice number, amount, and consequence (e.g. "Mark paid → N
  claims move to the payout queue").

### Invoice detail (`src/app/invoices/[id]/page.tsx`)
- **Billed Claims section** — every line item links to its claim detail, closing the
  invoice → claim traceability loop.
- **Confirmation** on issue / mark-paid / archive (was a one-shot mutation).
- **Shared feedback** (`SuccessBanner` / `FinancialExceptionBanner`) and a status pill.

### Claim detail (`src/app/reimbursements/[id]/page.tsx`)
- **Invoice relationship surfaced authoritatively** from the claim payload's
  `invoiceId` / `invoiceNumber` / `invoiceStatus` (Phase 2 read-time join), replacing a
  fragile payment-record lookup as the invoice source.
- **Financial timeline now links to the funding invoice** (passed `invoiceId` /
  `invoiceNumber`).
- **Corrected the "approved" guidance** — it now points to the Claims page ("Go To
  Claims") instead of the old "Go To Invoices", matching where generation actually lives.

---

## REMOVED

- **Three duplicate "Generate Invoice" CTAs** on the Invoices page (header, banner,
  empty-state) plus the inline generate modal → replaced by a single "Start billing" link.
- **Org drill-down state** (`selectedOrg` / `viewOrg` / `backToOverview`) on Invoices →
  replaced by the flat list + org-first ledger tabs.
- **`InvoiceTimeline`** from the flat invoice list (redundant with the status column +
  detail page).
- **Five page-scoped KPI cards** computed from the paginated org slice (a page-scoped
  aggregation bug) on the Invoices page.
- **Unconfirmed `runAction`** on Invoices → every issue/pay/archive now confirms first.
- **"Send Update" bulk communication** from the Claims page (a Notifications/Requests
  feature, explicitly out of scope). The `/api/super-admin/reimbursements/bulk-update`
  proxy route remains untouched.
- **Best-effort payment lookup as the invoice source** on claim detail → the claim
  payload's `invoiceId`/`invoiceNumber`/`invoiceStatus` is now the single source of truth.

---

## COMPONENT ARCHITECTURE

Pure logic lives in `src/lib/financial/` (framework-free, unit-tested); presentation lives
in `src/components/financial/`; pages compose them.

| Module | Kind | Responsibility |
|---|---|---|
| `lib/financial/format.ts` | logic | `formatCurrency` (OMR, 3dp), `formatDate` |
| `lib/financial/status.ts` | logic | Frozen claim status + invoice lifecycle labels |
| `lib/financial/eligibility.ts` | logic | `isEligibleForInvoicing`, `billingEligibility`, `billingEligibilityMeta` |
| `lib/financial/selection.ts` | logic | `Map`-based shortlist + array-based dialog selection helpers |
| `lib/financial/invoice.ts` | logic | `buildGenerateRequest`, `buildInvoiceReviewSummary` |
| `components/financial/FinancialEmptyState.tsx` | UI | Reason + next-step empty states |
| `components/financial/FinancialSkeleton.tsx` | UI | Table/summary skeletons (no layout shift) |
| `components/financial/BillingEligibilityBadge.tsx` | UI | Derived eligibility pill + invoice link |
| `components/financial/ConfirmActionDialog.tsx` | UI | Context-before-confirmation modal |
| `components/financial/GenerateInvoiceDialog.tsx` | UI | Pre-generation review (org + claims + running total) |
| `components/financial/FinancialNextAction.tsx` | UI | Single recommended-action banner (`action` + `onAction`) |

Existing shared components reused (not modified except where noted): `WorkflowStepper`,
`SuccessBanner`, `FinancialWorkflowHeader`, `FinancialExceptionBanner`,
`FinancialRecordLink`, `PrintableInvoice`, `PrintableClaimReceipt`, `FinancialTimeline`.

---

## WORKFLOW VERIFIED

The frozen backend workflow is unchanged and reflected faithfully in the UI:

```
claim.status: pending → in_progress → approved → to_be_paid → paid
                                    (rejected / frozen are side states)

invoice.status: draft → issued → paid → archived
```

- **Eligibility** = `claim.status === "approved"` AND not referenced by any invoice line
  item (draft / issued / paid / archived). "Invoiced" is a *relationship*, never a claim
  status.
- **Generate** is one-org + explicit claim ids (never a date range); the dialog sends
  `{ tenantId, claimIds }` and the tenant app re-validates atomically.
- **Issue** (`draft → issued`) → invoice becomes payable, shows as outstanding in A/R.
- **Mark paid** (`issued → paid`) → each linked `approved` claim is queued
  (`approved → to_be_paid`) for clinic payout.
- **Archive** (`draft`/`paid → archived`) → no longer payable.
- Super Admin does **not** receive tenant-admin claim-review actions (Approve / Reject /
  Freeze / Move-to-InProgress).

---

## API INTEGRATION

All reads/writes go through the existing thin proxy (`x-admin-api-key`), no duplicate
endpoints added.

| UI surface | Endpoint(s) |
|---|---|
| Organization selector | `GET /api/super-admin/tenants` |
| Claims table | `GET /api/super-admin/reimbursements` (`tenantId`, `status`, `search`, `dateFrom`, `dateTo`, `skip`, `limit`, `sortBy`, `sortOrder`) |
| Org eligible claims | `GET /api/super-admin/reimbursements?status=approved&tenantId=…` |
| Generate invoice | `POST /api/super-admin/invoices/generate` (`{ tenantId, claimIds }`) |
| Invoice history list | `GET /api/super-admin/invoices` (`tenantId`, `status`, `skip`, `limit`) |
| A/R ledger | `GET /api/super-admin/invoices/ledger` (`tenantId`, `status`, `daysOutstanding`, `search`) |
| Invoice detail | `GET /api/super-admin/invoices/[id]` |
| Issue / pay / archive | `POST /api/super-admin/invoices/[id]/issue|pay|archive` |
| Invoice export / aging | `GET /api/super-admin/invoices/[id]/export`, `…/export/[orgId]`, `…/report/aging` |
| Claim detail | `GET /api/super-admin/reimbursements/[id]` (exposes `invoiceId`/`invoiceNumber`/`invoiceStatus`) |

Note: the flat invoice list has **no server-side search/sort** (the tenant-app list route
reads only `tenantId`/`status`/`skip`/`limit`). Organization names are resolved
client-side from the tenants array.

---

## TEST RESULTS

`npm test` → **42 tests, 15 suites, 0 failures**.

New pure-logic suites under `src/lib/financial/tests/`:

- `eligibility.test.ts` — `isEligibleForInvoicing`, `billingEligibility` (all branches),
  `billingEligibilityMeta` (only `ready_for_invoicing` is selectable).
- `selection.test.ts` — map toggle / select-many / clear / count / total, array toggle /
  select-all / clear.
- `invoice.test.ts` — frozen generate contract, review-summary clinic dedupe + totals.
- `format.test.ts` — currency + date edge cases (null/empty/invalid).
- `status.test.ts` — frozen label coverage.

`npx tsc --noEmit` → clean.

`package.json` test script now runs both the existing tenant-auth suite and the new
financial suite (existing tests untouched).

---

## FILES CHANGED

**New — pure logic**
- `src/lib/financial/format.ts`
- `src/lib/financial/status.ts`
- `src/lib/financial/eligibility.ts`
- `src/lib/financial/selection.ts`
- `src/lib/financial/invoice.ts`

**New — shared components**
- `src/components/financial/FinancialEmptyState.tsx`
- `src/components/financial/FinancialSkeleton.tsx`
- `src/components/financial/BillingEligibilityBadge.tsx`
- `src/components/financial/ConfirmActionDialog.tsx`
- `src/components/financial/GenerateInvoiceDialog.tsx`

**Edited — shared components**
- `src/components/financial/FinancialNextAction.tsx` (added `onAction` button variant)

**Rebuilt — pages**
- `src/app/reimbursements/page.tsx` (Claims)
- `src/app/invoices/page.tsx` (Invoices history + A/R ledger)
- `src/app/invoices/[id]/page.tsx` (Invoice detail)

**Edited — pages**
- `src/app/reimbursements/[id]/page.tsx` (invoice relationship, corrected guidance)

**New — tests**
- `src/lib/financial/tests/eligibility.test.ts`
- `src/lib/financial/tests/selection.test.ts`
- `src/lib/financial/tests/invoice.test.ts`
- `src/lib/financial/tests/format.test.ts`
- `src/lib/financial/tests/status.test.ts`

**Edited — config**
- `package.json` (test glob extended)

---

## DEFERRED

Out of scope per the phase charter — deliberately not touched:

- **Payments redesign / payment business logic** (payout UI, bulk payout, payment-record
  dialogs). The Payments page still links to `/invoices`; not rebuilt here.
- **Chat / Requests / Notifications / Authentication** — including the removed "Send
  Update" bulk action.
- **Database redesign, state-machine changes, backend invoice logic.**
- **Application-wide caching / performance optimization.**
- **Final global SaaS dashboard redesign.**

---

## BLOCKERS

None. The Claims → Invoice UI rebuild is complete, verified, and documented.
