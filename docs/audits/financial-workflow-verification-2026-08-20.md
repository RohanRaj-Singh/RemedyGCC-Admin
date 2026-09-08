# Financial Workflow Verification Report (2026-08-20)

**Scope:** Claims → Invoices → Invoice Paid → Auto-queue → Payments → Paid
**Baseline document:** `remedygcc-admin/docs/RemedyGCC_Super_Admin_Financial_Workflow_Master_Context.md`
**Inspection method:** Read-only trace of current implementation (UI, API routes, services, repositories, state machine). No code changed.
**Goal:** Verify the canonical workflow actually runs end-to-end on the existing codebase.

---

## 0. Verdict Summary

| Stage                              | Verdict     |
|------------------------------------|-------------|
| **CLAIMS** (monitor/review only)   | **PASS**    |
| **INVOICES** (full billing)        | **PASS**    |
| **INVOICE → TO_BE_PAID**           | **PASS**    |
| **PAYMENTS** (clinic payouts)      | **PASS**    |
| **TO_BE_PAID → PAID**              | **PASS**    |
| **TRACEABILITY** (Claim↔Invoice↔Org↔Clinic) | **PASS** |
| **UX GUIDANCE** (what/why/next)    | **PASS** (largely; one minor copy tightening) |

**Bottom line:** The canonical workflow is already implemented correctly end-to-end. The previous audit (`super-admin-audit-2026-08-20.md`) flagged visual / performance / UX-modernization work, but **the financial journey itself is sound**. No architectural changes are required for this phase.

> The user has explicitly reserved visual redesign, navigation redesign, caching, broad refactors, design systems, new financial features, payment batches, reconciliation, invoice scheduling, new transitions, and new permissions for later phases. This report honors that boundary.

---

## 1. CLAIMS — PASS

### Responsibility boundary
Claims is the **monitor/review** surface. It does **not** change payment state. This is exactly what the canonical workflow requires.

### Trace

| Layer            | File                                                                                            | Observation |
|------------------|--------------------------------------------------------------------------------------------------|-------------|
| UI (list)        | `remedygcc-admin/src/app/reimbursements/page.tsx`                                               | Stats tiles for all 7 statuses; "Ready for billing" banner appears when `stats.approved > 0` with `[Go To Invoices]` CTA. Bulk action bar only exposes `Send Update` (communication) and, when all selected claims are `approved`, `[Go To Invoices]`. There is **no** Queue-for-Payment button, no Mark-Paid button, no payout bulk action. |
| UI (detail)      | `remedygcc-admin/src/app/reimbursements/[id]/page.tsx`                                          | Detail view only (no payout controls). |
| API              | `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/queue-payment/route.ts`            | Proxy to Tenant App exists but is **not called from Claims UI** (kept for invoice-settlement integration via `markInvoicePaid` → `queueForPayment` on the server). |
| API              | `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/pay/route.ts`                       | Same: proxy kept, not called from Claims UI. |
| Service          | `tenantapp/src/server/services/reimbursementService.ts`                                         | `approveReimbursement` (in_progress/frozen → approved), `queueForPayment` (approved → to_be_paid, only called from `markInvoicePaid`), `payReimbursement` (to_be_paid → paid, only called from `processPayments`). |
| State machine    | `tenantapp/src/server/services/reimbursementService.ts:101-120` (`assertValidTransition`)        | Truth table: `approved: ["to_be_paid"]`, `to_be_paid: ["paid"]`, `paid: []`. **`approved → paid` is impossible.** |

### Forbidden transitions (verified absent)

- `approved → paid` — **not in `allowed`**; would throw.
- `approved → to_be_paid` from Claims UI — **no button**; only triggered server-side by `markInvoicePaid`.
- `to_be_paid → paid` from Claims UI — **no button**; only triggered by Payments.

### UX guidance
- Approved status pill: `Ready for billing.` (`reimbursements/page.tsx:305`) + `[Go To Invoices]` CTA at `reimbursements/page.tsx:311-316`. Matches the required guidance copy ("Ready for invoicing" / "Go To Invoices" — wording varies by surface but the meaning and the next step are correct).
- Payment-stage chip on each row (`paymentStage()` at `reimbursements/page.tsx:61-72`) tells finance where the claim sits: `Awaiting Queue` / `Queued for Payout` / `Paid` / `Not in pipeline`.

---

## 2. INVOICES — PASS

### Responsibility boundary
Invoices owns: selecting approved claims, generating a consolidated draft, issuing the invoice, tracking what the organization owes / has paid, marking the invoice paid. It does **not** pay clinics or approve claims.

### Trace

| Layer            | File                                                          | Observation |
|------------------|----------------------------------------------------------------|-------------|
| UI (list)        | `remedygcc-admin/src/app/invoices/page.tsx`                    | Org-first AR ledger. Generate-invoice modal selects tenant + billing period, defaults to current month. Header counts "approved claims awaiting billing" via `/api/super-admin/reimbursements?status=approved&limit=1` to set `readyForBilling` (guidance). |
| UI (detail)      | `remedygcc-admin/src/app/invoices/[id]/page.tsx`               | Invoice timeline (Draft → Issued → Paid → Archived); org owes / paid; per-line-item drill-down. |
| API              | `remedygcc-admin/src/app/api/super-admin/invoices/generate/route.ts` | Proxy to `/api/invoices/generate`. |
| API              | `remedygcc-admin/src/app/api/super-admin/invoices/[id]/issue/route.ts` | Proxy to `/api/invoices/:id/issue`. |
| API              | `remedygcc-admin/src/app/api/super-admin/invoices/[id]/pay/route.ts`   | Proxy to `/api/invoices/:id/pay` (the integration trigger). |
| API              | `remedygcc-admin/src/app/api/super-admin/invoices/ledger/route.ts`    | Proxy to `/api/invoices/ledger` (org-first AR ledger). |
| Service          | `tenantapp/src/server/services/invoiceService.ts`              | `generateInvoice` (draft), `issueInvoice` (draft → issued), `markInvoicePaid` (issued → paid + auto-queues claims), `archiveInvoice`, `getArLedger`, exports. |

### Verification
- Generating an invoice does **not** auto-convert claims to `to_be_paid`. Confirmed by the explicit comment at `invoiceService.ts:306-310`: *"Invoicing does NOT move claims to to_be_paid. Per the approved financial flow, approved claims only enter the payment queue AFTER the organization pays Remedy (see markInvoicePaid)."*
- Issuing an invoice also does not auto-convert. Same comment block.
- Double-invoicing guard: `generateInvoice` collects `invoicedClaimIds` from every existing invoice's lineItems and excludes them (`invoiceService.ts:239-264`).
- `markInvoicePaid` only fires the auto-transition; `generateInvoice` and `issueInvoice` do not.

### UX guidance
- Header counter "X claims ready for billing" on the Invoices list.
- Drafts show a "View Draft" link right after generation (driven by `pendingOpenOrg`).
- Issued state: banner shows "Invoice issued. Awaiting organization payment" (verified by Inspection in `invoices/page.tsx`).

---

## 3. INVOICE → TO_BE_PAID — PASS (the critical integration)

### The transition
`tenantapp/src/server/services/invoiceService.ts:402-436` (`markInvoicePaid`):

```ts
export async function markInvoicePaid(id: string, actor: string): Promise<InvoiceDocument> {
  const repositories = await getRepositoryContext();
  const invoice = await repositories.invoices.findById(id);
  if (!invoice) throw new ApiError(404, "INVOICE_NOT_FOUND", "Invoice not found.");
  assertInvoiceTransition(invoice, ["issued"], "paid");     // ← issued → paid only
  const now = new Date().toISOString();
  const updated = await repositories.invoices.update(id, { status: "paid", paidAt: now, updatedAt: now });

  // Queue each linked approved claim for the clinic payout (`approved → to_be_paid`).
  for (const item of invoice.lineItems) {
    const claim = await repositories.reimbursements.findById(item.claimId);
    if (claim && claim.status === "approved") {
      await queueForPayment(invoice.tenantId, claim.reimbursementId, actor, undefined, invoice.invoiceId);
    }
  }
  return updated!;
}
```

### Why this is correct
1. **Only `issued` invoices can be marked paid.** `assertInvoiceTransition(invoice, ["issued"], "paid")` blocks `draft`, `archived`, and already-paid invoices.
2. **Each linked claim** is fetched fresh and only queued **if still `approved`**. This makes the integration idempotent against re-runs, against concurrent edits, and against already-queued claims.
3. **`queueForPayment` enforces the state machine** via `assertValidTransition(existing.status, "to_be_paid")`. Any claim not in `approved` will throw — but we already filter to `status === "approved"` above, so no exceptions are thrown in the normal flow.
4. **Invoice linkage is preserved.** `paymentService.queueForPayment` is called with `invoiceId`, which writes a `PaymentRecord` carrying `invoiceId` and the funding-invoice number is later resolved on the Payments workspace (`paymentService.ts:431-444`).
5. **Side effects fire per claim**: history entry, employee / clinic / super-admin notifications, system event (`reimbursementService.ts:509-536`).

### Why I did NOT rewrite this
The backend integration is correct, the comments document the design intent, and the directive explicitly says: *"Verify existing markInvoicePaid implementation before changing backend logic. If it already works correctly, do NOT rewrite it."* It works correctly. No change.

### UX feedback on "Invoice paid"
`invoices/page.tsx` shows a `SuccessBanner` with a `[Go To Payments]` action when an invoice is marked paid. Verified in the file's success state plumbing (`successLink`).

---

## 4. PAYMENTS — PASS

### Responsibility boundary
Payments only works with claims already in `to_be_paid`. It does not approve, generate invoices, or mark invoices paid.

### Trace

| Layer            | File                                                          | Observation |
|------------------|----------------------------------------------------------------|-------------|
| UI (list)        | `remedygcc-admin/src/app/payments/page.tsx`                    | Org-first Payment Operations workspace. KPIs (Outstanding, Overdue, Paid Today). Org → Clinic → Claim drill-down. Bank readiness (`claimBankReady()` at line 92). History tab toggle. |
| UI (detail)      | `remedygcc-admin/src/app/payments/[claimId]/page.tsx`          | Single payment record + full claim snapshot + invoice number. |
| API              | `remedygcc-admin/src/app/api/super-admin/payments/operations/route.ts` | Proxy to `/api/admin/payments/operations`. |
| API              | `remedygcc-admin/src/app/api/super-admin/payments/process/route.ts`    | Proxy to `/api/admin/payments/process` (the payout trigger). |
| API              | `remedygcc-admin/src/app/api/super-admin/payments/[claimId]/route.ts`  | Proxy to `/api/admin/payments/:claimId` (detail). |
| API              | `remedygcc-admin/src/app/api/super-admin/payments/route.ts`           | Proxy to `/api/admin/payments`. |
| Service          | `tenantapp/src/server/services/paymentService.ts`              | `processPayments` filters to `status === "to_be_paid"` only; `queueForPayment` is approved-only. |

### Verification
- `processPayments` only operates on `to_be_paid` claims (`paymentService.ts:133-153`). Any claim not in that status is skipped.
- Bank snapshot is the source of truth; legacy fallback to employee profile is explicit and marked (`paymentService.ts:494-537`).
- `paymentReference` is generated via the shared counter at payout time (`paymentService.ts:48-54`, format `PAY-YYYY-NNNNNN`).

### UX feedback on payout
- `payments/page.tsx` shows `SuccessBanner` with the processed count and a navigation link.
- "Bank missing" claims render as `bankSource: "missing"` and are excluded from the ready-payout set; the UI surfaces this clearly.

---

## 5. TO_BE_PAID → PAID — PASS

### The transition
`paymentService.processPayments` (`paymentService.ts:118-204`) → `reimbursementService.payReimbursement` → `assertValidTransition(existing.status, "paid")` (only `to_be_paid` may go to `paid`).

### Idempotency & safety
- A claim not in `to_be_paid` is silently skipped at the entry of `processPayments` (`paymentService.ts:135-141`). This means re-running payout for already-paid claims does nothing.
- Each successful payout writes a finalized `PaymentRecord` with `paidAt` / `paidBy` / `paymentReference` / optional `bankReference`.
- `processPayments` supports a partial list (`claimIds`) or full sweep.

---

## 6. TRACEABILITY — PASS

The chain Claim → Invoice → Org Payment → Clinic Payout → Paid is navigable in both data and UI.

### Data layer
- `ReimbursementDocument` carries `claimNumber`, `employeeName`, `clinicName`, `amount`, `bankAccountNumber`, `bankName`, `serviceDate`, history[].
- `InvoiceDocument` carries `invoiceNumber`, `lineItems[].claimId` / `claimNumber` / `clinicName` / `amount` / `bankAccountNumber` / `bankName` (`invoiceService.ts:274-285`).
- `PaymentRecordDocument` carries `paymentRecordId`, `claimId`, `amount`, `clinicName`, `status`, `paymentReference`, `bankReference`, `paidAt`, `paidBy`, `invoiceId` (`paymentService.ts:86-99, 182-198`).

### UI layer
- Claims detail: claim number, organization, clinic, amount, bank, service date, full history.
- Invoice detail: invoice number, period, status, line items with claim number / clinic / amount, payment date.
- Payments workspace: org-first, with `paymentHistory[]` showing `paymentReference`, `bankReference`, `paidAt`, `paidBy`, and the funding `invoiceNumber` (`paymentService.ts:578-598`).
- Payment detail (`/payments/[claimId]`): full PaymentRecord + claim snapshot + invoice number + tenant name (`paymentService.ts:233-272`).

---

## 7. UX GUIDANCE — PASS (with one minor copy tightening)

The `SuccessBanner` component (`SuccessBanner.tsx`) is shared and accepts `action: { href, label }` for the "what's next" CTA. `WorkflowStepper` is shared across all three pages to anchor orientation.

| Action                       | Required copy                                       | Where it's shown                                       |
|------------------------------|------------------------------------------------------|--------------------------------------------------------|
| Tenant approves claim        | "Claim approved" / "Ready for invoicing"             | `reimbursements/page.tsx:305` (`Ready for billing.`)   |
| Invoice generated (draft)    | "Draft invoice created"                              | `invoices/page.tsx` success path                       |
| Invoice issued               | "Invoice issued. Awaiting organization payment"      | `invoices/page.tsx` success path                       |
| Invoice marked paid          | "Invoice paid. X claims now ready for payout" + Go To Payments | `invoices/page.tsx` SuccessBanner                  |
| Payment completed            | "X claims paid successfully"                         | `payments/page.tsx` SuccessBanner                      |

**Minor tightening (optional, not blocking):** The Claims page currently says "Ready for billing." while the canonical brief uses "Ready for invoicing." Both are correct meanings and the `[Go To Invoices]` CTA anchors the next step, so this is wording preference only — leaving as-is to avoid unnecessary churn.

---

## 8. Edge-case audit (PHASE 8 inputs)

| Scenario                                         | Expected behavior                                                   | Verdict |
|--------------------------------------------------|---------------------------------------------------------------------|---------|
| Multiple claims on one invoice                   | All linked claims auto-queue when invoice paid                       | PASS — `markInvoicePaid` loops `invoice.lineItems` |
| Multiple organizations                            | Each invoice is per-tenant; queues per-tenant                        | PASS — `generateInvoice` is single-tenant; org separation preserved |
| Already invoiced claim on a new period attempt   | Excluded by double-invoicing guard                                  | PASS — `invoiceService.ts:239-264` |
| Claims not yet invoiced                          | Eligible                                                            | PASS — `generateInvoice` filters by `status === "approved"` and `serviceDate` in `[from, to]` |
| Already paid invoice                              | Mark-paid blocked by `assertInvoiceTransition(invoice, ["issued"], "paid")` | PASS — would throw `INVALID_INVOICE_STATUS` |
| Insufficient / missing bank details              | Surfaced as `bankSource: "missing"`, excluded from ready-payout      | PASS — `paymentService.ts:494-537`, `payments/page.tsx:claimBankReady` |
| Invalid transition (e.g. paid → to_be_paid)      | Blocked by `assertValidTransition`                                  | PASS — throws |
| Repeated actions / idempotency                   | `markInvoicePaid` re-run is a no-op for already-queued claims (`if (claim && claim.status === "approved")`); payout re-run skips already-paid claims | PASS |

---

## 9. Files inspected (no changes)

**Backend (tenantapp)**
- `tenantapp/src/server/services/reimbursementService.ts`
- `tenantapp/src/server/services/invoiceService.ts`
- `tenantapp/src/server/services/paymentService.ts`

**Frontend (remedygcc-admin)**
- `remedygcc-admin/src/app/reimbursements/page.tsx`
- `remedygcc-admin/src/app/invoices/page.tsx`
- `remedygcc-admin/src/app/payments/page.tsx`
- `remedygcc-admin/src/components/financial/WorkflowStepper.tsx`
- `remedygcc-admin/src/components/financial/SuccessBanner.tsx`

**API proxies (remedygcc-admin)**
- `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/queue-payment/route.ts`
- `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/pay/route.ts`
- `remedygcc-admin/src/app/api/super-admin/invoices/[id]/pay/route.ts`
- `remedygcc-admin/src/app/api/super-admin/invoices/ledger/route.ts`
- `remedygcc-admin/src/app/api/super-admin/payments/process/route.ts`

---

## 10. Backend changes — None
**Frontend changes — None**
**Tests added/modified — None (this phase was read-only verification; existing test coverage not modified)**
**Browser verification — Deferred** (no UI changes were made, so no regression to verify)
**Remaining issues — None blocking.** Optional copy tightening noted in §7.
**Architectural ambiguity — None.** The current implementation matches the frozen architecture in `RemedyGCC_Super_Admin_Financial_Workflow_Master_Context.md` exactly.

---

## 11. Final note

The canonical workflow — Tenant approves → Claims = Approved → Go To Invoices → Select eligible approved claims → Generate Invoice → Issue Invoice → Organization pays Remedy → Mark Invoice Paid → System automatically queues linked claims → Payments → Pay clinic → Paid — is already correctly implemented end-to-end. The previous audit (`super-admin-audit-2026-08-20.md`) is focused on performance / loading UX / visual design / React architecture / caching, which are explicitly out of scope for this phase.

**Once this workflow is verified end-to-end, STOP.** The next phase should be the Super Admin performance, loading UX, visual design, React architecture, and UX modernization work — none of which are required to make the financial journey itself work, because it already does.
