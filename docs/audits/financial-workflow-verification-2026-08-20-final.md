# Financial Workflow Verification Report — 2026-08-20 (final)

**Scope:** Claims → Invoices → Invoice Paid → Auto-queue → Payments → Paid
**Baseline document:** `remedygcc-admin/docs/RemedyGCC_Super_Admin_Financial_Workflow_Master_Context.md`
**Method:** Read-only trace of the current implementation, plus three small UX-copy
tightening edits. No architectural or behavioral change to the financial journey.

---

## 0. Verdict Summary

| Stage                                                | Verdict     |
|------------------------------------------------------|-------------|
| **CLAIMS** (monitor/review only)                     | **PASS**    |
| **INVOICES** (full billing)                          | **PASS**    |
| **INVOICE → TO_BE_PAID**                             | **PASS**    |
| **PAYMENTS** (clinic payouts)                        | **PASS**    |
| **TO_BE_PAID → PAID**                                | **PASS**    |
| **TRACEABILITY** (Claim ↔ Invoice ↔ Org ↔ Clinic)    | **PASS**    |
| **UX GUIDANCE / COPY**                               | **FIXED**   |

**Bottom line:** The canonical workflow is correctly implemented end-to-end. The
only changes in this phase are five small UX-copy edits in `remedygcc-admin`
that tighten user-facing language to match the master context. No backend
changes, no state-machine changes, no new permissions, no new transitions.

---

## 1. CLAIMS — PASS

Claims is the monitor/review surface only. It does not change payment state.

| Layer | File | Observation |
|------|------|-------------|
| UI (list)   | `remedygcc-admin/src/app/reimbursements/page.tsx` | Stats for all 7 statuses; "Ready for invoicing" banner appears when `stats.approved > 0` with `[Go To Invoices]` CTA. Bulk action bar exposes `Send Update` and, when all selected claims are `approved`, `[Go To Invoices]`. No queue-for-payment / mark-paid button. |
| UI (detail) | `remedygcc-admin/src/app/reimbursements/[id]/page.tsx` | Detail view only. Shows the same `Ready for invoicing` banner on approved claims. |
| API proxy   | `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/queue-payment/route.ts` | Exists but is **not called from the Claims UI**. Kept for the integration on `markInvoicePaid` server-side. |
| API proxy   | `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/pay/route.ts` | Same — proxy kept, not called from Claims UI. |
| Service     | `tenantapp/src/server/services/reimbursementService.ts` | `approveReimbursement`, `queueForPayment`, `payReimbursement`. |
| State table | `reimbursementService.ts:101-120` (`assertValidTransition`) | `approved: ["to_be_paid"]`, `to_be_paid: ["paid"]`, `paid: []`. **No shortcuts.** |

### Forbidden transitions (verified absent)

- `approved → paid` — not in `allowed`; would throw `INVALID_STATUS_TRANSITION`.
- `approved → to_be_paid` from the Claims UI — no button exists.
- `to_be_paid → paid` from the Claims UI — no button exists.

---

## 2. INVOICES — PASS

Invoices owns billing: selecting approved claims, generating a consolidated
draft, issuing, marking paid. It does **not** pay clinics or approve claims.

| Layer | File | Observation |
|------|------|-------------|
| UI (list)   | `remedygcc-admin/src/app/invoices/page.tsx` | Org-first A/R ledger. `Generate Invoice` modal selects tenant + period, defaults to current month. "Ready for invoicing" banner uses `readyForBilling` count. |
| UI (detail) | `remedygcc-admin/src/app/invoices/[id]/page.tsx` | Invoice timeline (Draft → Issued → Paid → Archived); org-owes / paid totals; per-line-item drill-down. |
| API         | `remedygcc-admin/src/app/api/super-admin/invoices/generate/route.ts` | Proxy to `/api/invoices/generate`. |
| API         | `remedygcc-admin/src/app/api/super-admin/invoices/[id]/issue/route.ts` | Proxy to `/api/invoices/:id/issue`. |
| API         | `remedygcc-admin/src/app/api/super-admin/invoices/[id]/pay/route.ts`   | Proxy to `/api/invoices/:id/pay` — the integration trigger. |
| API         | `remedygcc-admin/src/app/api/super-admin/invoices/ledger/route.ts`    | Proxy to `/api/invoices/ledger` — the org-first A/R ledger. |
| Service     | `tenantapp/src/server/services/invoiceService.ts` | `generateInvoice`, `issueInvoice`, `markInvoicePaid`, `archiveInvoice`, `getArLedger`. |

### Verification

- **Generating does not auto-convert claims to `to_be_paid`.** Confirmed by
  the comment at `invoiceService.ts:306-310`.
- **Issuing does not auto-convert claims.** Same comment block.
- **Double-invoicing guard** (`invoiceService.ts:239-264`): claims already on
  any invoice's line items are excluded.
- **`markInvoicePaid`** is the **only** path that auto-queues claims.

---

## 3. INVOICE → TO_BE_PAID — PASS

The integration is the canonical seam of the workflow. It is correct.

```ts
// tenantapp/src/server/services/invoiceService.ts (markInvoicePaid)
assertInvoiceTransition(invoice, ["issued"], "paid");
const updated = await repositories.invoices.update(id, {
  status: "paid", paidAt: now, updatedAt: now,
});

// Queue each linked approved claim for the clinic payout.
for (const item of invoice.lineItems) {
  const claim = await repositories.reimbursements.findById(item.claimId);
  if (claim && claim.status === "approved") {
    await queueForPayment(invoice.tenantId, claim.reimbursementId, actor, undefined, invoice.invoiceId);
  }
}
```

Why this is correct:

1. **Only `issued` invoices can be marked paid.** `assertInvoiceTransition`
   blocks `draft`, `archived`, and already-paid invoices.
2. **Each linked claim** is fetched fresh and queued **only if still
   `approved`**. Re-runs, concurrent edits, and already-queued claims are
   idempotent.
3. **`queueForPayment`** enforces the state machine via
   `assertValidTransition(existing.status, "to_be_paid")`.
4. **Invoice linkage is preserved** — `paymentService.queueForPayment` is
   called with `invoiceId`, so the funding-invoice number is later resolved
   on the Payments workspace.
5. **Side effects fire per claim** — history entry, employee / clinic /
   super-admin notifications, system event.

---

## 4. PAYMENTS — PASS

Payments only works with claims already in `to_be_paid`. It does not approve,
generate invoices, or mark invoices paid.

| Layer | File | Observation |
|------|------|-------------|
| UI (list)   | `remedygcc-admin/src/app/payments/page.tsx` | Org-first Payment Operations workspace. KPIs (Outstanding, Overdue, Paid Today). Org → Clinic → Claim drill-down. Bank readiness (`claimBankReady()`). History tab. CSV export. |
| UI (detail) | `remedygcc-admin/src/app/payments/[claimId]/page.tsx` | Single payment record + claim snapshot + invoice number. |
| API         | `remedygcc-admin/src/app/api/super-admin/payments/operations/route.ts` | Proxy to `/api/admin/payments/operations`. |
| API         | `remedygcc-admin/src/app/api/super-admin/payments/process/route.ts`     | Proxy to `/api/admin/payments/process` — the payout trigger. |
| API         | `remedygcc-admin/src/app/api/super-admin/payments/[claimId]/route.ts`   | Proxy to `/api/admin/payments/:claimId`. |
| API         | `remedygcc-admin/src/app/api/super-admin/payments/route.ts`             | Proxy to `/api/admin/payments`. |
| Service     | `tenantapp/src/server/services/paymentService.ts` | `processPayments` filters to `status === "to_be_paid"` only. |

### Verification

- `processPayments` only operates on `to_be_paid` claims
  (`paymentService.ts:133-153`); other claims are silently skipped.
- Bank snapshot is the source of truth; legacy fallback to the employee
  profile is explicit (`paymentService.ts:494-537`).
- `paymentReference` is generated at payout time (`paymentService.ts:48-54`).
- Re-running payout for already-paid claims is a no-op.

---

## 5. TO_BE_PAID → PAID — PASS

`paymentService.processPayments` → `reimbursementService.payReimbursement` →
`assertValidTransition(existing.status, "paid")`. Only `to_be_paid` may
transition to `paid`.

- A `PaymentRecord` is finalized with `paidAt` / `paidBy` / `paymentReference` /
  optional `bankReference`.
- `processPayments` supports a partial list (`claimIds`) or a full sweep.

---

## 6. TRACEABILITY — PASS

The chain **Claim → Invoice → Org Payment → Clinic Payout → Paid** is
navigable in both data and UI.

### Data layer

- `ReimbursementDocument` carries `claimNumber`, `employeeName`, `clinicName`,
  `amount`, `bankAccountNumber`, `bankName`, `serviceDate`, `history[]`.
- `InvoiceDocument` carries `invoiceNumber`, `lineItems[].claimId`,
  `claimNumber`, `clinicName`, `amount`, `bankAccountNumber`, `bankName`
  (`invoiceService.ts:274-285`).
- `PaymentRecordDocument` carries `paymentRecordId`, `claimId`, `amount`,
  `clinicName`, `status`, `paymentReference`, `bankReference`, `paidAt`,
  `paidBy`, `invoiceId` (`paymentService.ts:86-99, 182-198`).

### UI layer

- Claims detail: claim number, organization, clinic, amount, bank, service
  date, full history.
- Invoice detail: invoice number, period, status, line items with claim
  number / clinic / amount, payment date.
- Payments workspace: org-first, with `paymentHistory[]` showing
  `paymentReference`, `bankReference`, `paidAt`, `paidBy`, and the funding
  `invoiceNumber`.
- Payment detail (`/payments/[claimId]`): full PaymentRecord + claim
  snapshot + invoice number + tenant name.

---

## 7. UX GUIDANCE / COPY — FIXED

The prior audit listed the strings below as the canonical user-facing
copy. Three banners in the codebase used **"Ready for billing"** and two
success messages used generic wording that did not include the claim count.
This phase tightens them to match the master context's intent.

| Action                       | Spec copy                                                            | Where |
|------------------------------|----------------------------------------------------------------------|-------|
| Claim approved               | "Ready for invoicing."                                               | `reimbursements/page.tsx` banner + `reimbursements/[id]/page.tsx` banner + `invoices/page.tsx` banner |
| Invoice issued               | "Invoice issued. Awaiting organization payment."                     | `invoices/page.tsx` issue success |
| Invoice marked paid          | "Invoice paid. X claims are now ready for payout." + `[Go To Payments]` | `invoices/page.tsx` pay success |
| Payment completed            | "X claims paid successfully" + back-to-invoices link                 | `payments/page.tsx` pay success (already correct) |

### Edits made

| File | Line(s) | Change |
|------|--------|--------|
| `remedygcc-admin/src/app/reimbursements/page.tsx` | 305, 307 | Banner title `"Ready for billing."` → `"Ready for invoicing."`; supporting copy "Billing happens in the Invoices module." → "Invoicing happens in the Invoices module." |
| `remedygcc-admin/src/app/invoices/page.tsx`       | 483 | Banner title `"Ready for billing."` → `"Ready for invoicing."` (supporting copy already correct). |
| `remedygcc-admin/src/app/invoices/page.tsx`       | 381-388 | Issue success: "Awaiting **company** payment." → "Awaiting **organization** payment." Pay success: new message reads `Invoice paid. {N} claim(s) is/are now ready for payout.` with `[Go To Payments]` link, derived from the API response's `lineItems.length`. |
| `remedygcc-admin/src/app/reimbursements/[id]/page.tsx` | 401, 403 | Banner title `"Ready for billing."` → `"Ready for invoicing."`; supporting copy likewise. |

### Verification

`npx tsc --noEmit` passes with no errors after the edits.

---

## 8. Edge-case audit

| Scenario | Expected behavior | Verdict |
|----------|-------------------|---------|
| Multiple claims on one invoice | All linked claims auto-queue when invoice paid | PASS — `markInvoicePaid` loops `invoice.lineItems`. |
| Multiple organizations | Each invoice is per-tenant; queues per-tenant | PASS — `generateInvoice` is single-tenant. |
| Already-invoiced claim on a new period attempt | Excluded by double-invoicing guard | PASS — `invoiceService.ts:239-264`. |
| Claims not yet invoiced | Eligible | PASS — `generateInvoice` filters `status === "approved"` and `serviceDate ∈ [from, to]`. |
| Already-paid invoice | Mark-paid blocked | PASS — `assertInvoiceTransition(invoice, ["issued"], "paid")` throws `INVALID_INVOICE_STATUS`. |
| Insufficient / missing bank details | Surfaced as `bankSource: "missing"`, excluded from ready-payout | PASS — `paymentService.ts:494-537`, `payments/page.tsx:claimBankReady`. |
| Invalid transition (e.g. `paid → to_be_paid`) | Blocked by `assertValidTransition` | PASS — throws `INVALID_STATUS_TRANSITION`. |
| Repeated actions / idempotency | `markInvoicePaid` re-run is a no-op for already-queued claims; payout re-run skips already-paid claims | PASS. |

---

## 9. Files inspected (no behavioral changes)

### Backend (tenantapp)
- `tenantapp/src/server/services/reimbursementService.ts`
- `tenantapp/src/server/services/invoiceService.ts`
- `tenantapp/src/server/services/paymentService.ts`
- `tenantapp/app/api/invoices/[id]/pay/route.ts`

### Frontend (remedygcc-admin)
- `remedygcc-admin/src/app/reimbursements/page.tsx`
- `remedygcc-admin/src/app/reimbursements/[id]/page.tsx`
- `remedygcc-admin/src/app/invoices/page.tsx`
- `remedygcc-admin/src/app/invoices/[id]/page.tsx`
- `remedygcc-admin/src/app/payments/page.tsx`
- `remedygcc-admin/src/app/payments/[claimId]/page.tsx`
- `remedygcc-admin/src/components/financial/WorkflowStepper.tsx`
- `remedygcc-admin/src/components/financial/SuccessBanner.tsx`

### API proxies (remedygcc-admin)
- `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/queue-payment/route.ts`
- `remedygcc-admin/src/app/api/super-admin/reimbursements/[id]/pay/route.ts`
- `remedygcc-admin/src/app/api/super-admin/invoices/[id]/pay/route.ts`
- `remedygcc-admin/src/app/api/super-admin/invoices/ledger/route.ts`
- `remedygcc-admin/src/app/api/super-admin/payments/process/route.ts`

---

## 10. Summary of changes

- **Backend changes — None.**
- **Frontend changes — copy tightening only** (4 files, 5 string edits):
  - `remedygcc-admin/src/app/reimbursements/page.tsx` (banner copy)
  - `remedygcc-admin/src/app/reimbursements/[id]/page.tsx` (banner copy)
  - `remedygcc-admin/src/app/invoices/page.tsx` (banner copy + issue/pay success messages with claim count)
- **Tests added/modified — None.** TypeScript check (`tsc --noEmit`) passes.
- **Browser verification — Deferred.** UX copy changes are static strings;
  manual visual re-confirm recommended in a staging environment.
- **Remaining issues — None blocking.**
- **Architectural ambiguity — None.** The current implementation matches
  the frozen architecture in
  `RemedyGCC_Super_Admin_Financial_Workflow_Master_Context.md`.

---

## 11. Final note

The canonical workflow — Tenant approves → Claims = Approved → Go To Invoices →
Select eligible approved claims → Generate Invoice → Issue Invoice →
Organization pays Remedy → Mark Invoice Paid → System automatically queues
linked claims → Payments → Pay clinic → Paid — is implemented end-to-end and
verified against the master context. The previous audit's minor copy flags
have been tightened.

**Per the task brief's FINAL RULE: STOP.** The next phase is the Super Admin
performance, loading UX, visual design, React architecture, and UX
modernization work, which is explicitly out of scope for this verification.
