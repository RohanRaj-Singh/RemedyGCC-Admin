# Claims + Invoices — UX/UI Audit Before Rebuild

**Phase 1A — Audit only.** No implementation, no component creation, no route/API/state-machine/database changes.
**Scope:** Super Admin → Claims, and Super Admin → Invoices. Payments is out of scope for this phase (referenced only where its boundary leaks into Claims/Invoices).
**Date:** 2026-08-26

---

## 1. Executive Summary

The Claims and Invoices experiences in the Super Admin are **functional but structurally misaligned with the client's confirmed billing mental model.** The data layer (TenantApp backend) implements a clean, defensible financial flow — approved → invoiced (draft) → issued → org pays → claim enters payout queue — but the admin UI does not expose that flow to the Super Admin in a way they can act on. The result is that the single most important, client-requested capability — **choose an organization, see its approved/eligible claims, select some or all of them, and generate an invoice from that selection** — does not exist.

Three findings dominate the audit and should gate every rebuild decision:

1. **Invoice generation is date-range based, not claim-selection based.** The backend `generateInvoice` accepts only `{ tenantId, from, to }` and silently scoops *every* approved claim in that window. The client explicitly asked for individual claim selection, Select All, and the ability to remove claims from a selection. The current UI's "Draft Invoice (N · $amount)" button is a navigation hint that leads to a broken deep link — it does not carry a claim selection at all.
2. **There is no "approved vs. already-invoiced" distinction on the Claims page.** Claims are never modified when invoiced (the double-invoicing guard is computed at generate time by scanning invoice line items). A claim sitting on a draft or issued invoice still reads `approved` and looks identical to a never-invoiced claim. The Super Admin cannot see, from Claims, which approved claims are still eligible to invoice.
3. **The Invoices page is an Accounts-Receivable ledger, not an invoice workspace.** It is titled "Billing Workspace" but is organized by organization with aging buckets; individual invoices are a drill-down. There is no first-class invoice history list, no draft review surface, and destructive actions (issue/pay/archive) execute with no confirmation. This is a consequence of a prior "Phase B" decision to demote Invoices — a decision this audit recommends revisiting, because it directly contradicts the client's stated "invoice review before issuing" and "invoice history" requirements.

The Claims page also carries several self-inflicted UX defects: a page-scoped KPI bug, a redundant second "payment stage" status column, selection that silently clears on filter/page change, and no organization selector. These are individually small but collectively erode trust in a financial surface where accuracy is the product.

**Recommendation:** Rebuild the Claims→Invoices experience as a single guided flow — `Organization → Eligible claims → Select → Generate draft → Review → Issue` — and restore Invoices as a first-class history/ledger workspace. Full target IA is in §18.

---

## 2. Scope & Method

**Audited surfaces:**

- `remedygcc-admin/src/app/reimbursements/page.tsx` (Claims list)
- `remedygcc-admin/src/app/reimbursements/[id]/page.tsx` (Claim detail)
- `remedygcc-admin/src/app/invoices/page.tsx` (Invoices / "Billing Workspace")
- `remedygcc-admin/src/app/invoices/[id]/page.tsx` (Invoice detail)
- Shared financial components (`src/components/financial/*`), claim components (`ClaimTimeline`, `FinancialTimeline`, `ClaimChat`), layout `Sidebar`
- Admin API proxy routes (`remedygcc-admin/src/app/api/**`)
- **Backend data model** (TenantApp) to answer eligibility/linkage questions: `invoiceService.ts`, `invoicesRepository.ts`, `reimbursementsRepository.ts`, `db/documents.ts`, and the `admin/reimbursements`, `invoices/*` route handlers
- Client requirements authority: `CLIENT_CLARIFICATION_MASTER.md` + the confirmed billing mental model

**Issue format:** Problem → User impact → Business impact → Evidence → Recommended UX principle.

**Source of truth note:** `CLIENT_CLARIFICATION_MASTER.md` is a question bank (open items to resolve with the client), not a set of answered requirements. Where this audit states "the client asked for X," it refers to the **confirmed** answers captured in the billing mental model (§3), not the open questions. Open questions that still block implementation are collected in §19.

---

## 3. The Confirmed Billing Mental Model (Source of Truth)

The client's confirmed mental model for the financial flow is:

> **Claims → Choose Organization → Identify approved/eligible claims → Select claims → Generate Invoice → Review Invoice → Issue Invoice → Await Organization Payment**

Explicit client requirements, in priority order:

1. **Individual claim selection** when building an invoice.
2. **Select All eligible claims** in one action.
3. **Bulk invoice generation** from a selection.
4. **Organization-aware selection** — the invoice is always scoped to one organization.
5. **Ability to remove claims** from an invoice selection before generating.
6. **Clear approved vs. invoiced distinction** — the Super Admin must always know which approved claims are still invoiceable.
7. **Invoice review before issuing** — a draft is reviewed, then issued.
8. **Invoice history** — a browsable record of invoices.
9. **Clear financial relationships** — claim ↔ invoice ↔ payment must be traceable.
10. **Minimal unnecessary navigation**, and a **"simple guided experience" that does not remove Super Admin power.**

Every finding in this audit is measured against these ten requirements.

---

## 4. Information Architecture & Navigation Audit

### 4.1 Invoices was demoted out of the primary navigation

- **Problem:** The sidebar intentionally omits "Invoices" (a comment reads "Phase B"), leaving Claims and Payments as the two primary workspaces. Invoices is reachable only via a "Billing Workspace" button on the Claims header and a status-guidance banner on claim detail.
- **User impact:** The Super Admin cannot navigate directly to invoice history; there is no persistent, discoverable entry point. The path to Invoices depends on being on the Claims page and recognizing an ambiguous "Billing Workspace" label.
- **Business impact:** Invoice history (§3 req. 8) is effectively hidden. A domain as sensitive as Accounts Receivable should be one click from anywhere, not two contextual hops.
- **Evidence:** `Sidebar.tsx` menuItems; `reimbursements/page.tsx` header "Billing Workspace" button → `/invoices`.
- **Recommended principle:** Persistent, predictable navigation for core financial domains (Navigation Patterns — predictable entry points). Restore "Invoices" as a first-class sidebar item (§18).

### 4.2 The Claims→Invoices deep link is broken

- **Problem:** `goToInvoiceDraft()` on the Claims page constructs `/invoices?tenantId=X&claims=<claimIds>` to pre-scope an invoice draft. The Invoices page reads **only** `?openOrg=` on mount; `tenantId` and `claims` are never parsed. The navigation succeeds but silently discards the entire selection.
- **User impact:** The Super Admin clicks "Draft Invoice (N · $amount)", believes they are proceeding with those N claims, and lands on a generic organization ledger with no selection carried forward. Silent data loss of intent.
- **Business impact:** A broken contract between two screens in a financial flow is a correctness risk — the exact thing a "guided experience" (req. 10) is meant to prevent.
- **Evidence:** `reimbursements/page.tsx` (goToInvoiceDraft, ~line 268); `invoices/page.tsx` mount effect reads only `openOrg`; backend `generate/route.ts` accepts only `tenantId, from, to` — it cannot honor a `claims` param even if one were passed.
- **Recommended principle:** Deep links must round-trip (Navigation Patterns — deep linking); either honor the params or remove the affordance. This is superseded by §18's selection model.

### 4.3 "Billing Workspace" is a misnomer for what is actually an A/R ledger

- **Problem:** The page titled "Billing Workspace" is organized by organization with columns for Total Outstanding, Overdue, Open Invoices, Last Invoice, Last Payment, and an aging status. It is an Accounts Receivable ledger, not a workspace for creating/reviewing invoices.
- **User impact:** The label promises invoice authoring but delivers receivable reporting; users learn the mapping by trial and error.
- **Business impact:** Mislabeled surfaces confuse the two jobs the client wants kept clear (generate an invoice vs. track who owes money).
- **Evidence:** `invoices/page.tsx` title + table; `getArLedger()` returns `organizations[]` with aging buckets.
- **Recommended principle:** Name the surface for what it is (§18: split "Generate" from "Receivables/History").

---

## 5. First-Impression & Visual-Design Audit

### 5.1 Eight KPI cards overwhelm the top of Claims

- **Problem:** The Claims page leads with eight `FinancialSummaryCards` — one per claim status (Total, Pending, In Progress, Approved, To Be Paid, Rejected, Frozen, Paid). Eight same-weight cards dilute rather than focus attention.
- **User impact:** The primary job ("which approved claims can I invoice?") is not surfaced; it is buried as one of eight cards.
- **Business impact:** The most decision-relevant number — invoiceable amount — is absent (§11), while seven statuses compete for equal visual weight.
- **Evidence:** `reimbursements/page.tsx` summary cards; `FinancialSummaryCards.tsx`.
- **Recommended principle:** Visual hierarchy via size/spacing (Layout — visual hierarchy). Collapse to 3–4 decision cards: **Eligible to invoice**, **In-progress**, **Awaiting payout**, **Paid this period** (§18).

### 5.2 Redundant "payment stage" column on the claims table

- **Problem:** `paymentStage()` derives a second, status-like column ("Awaiting Queue" / "Queued for Payout" / "Paid" / "Not in pipeline") that runs parallel to the actual `status` column.
- **User impact:** Two adjacent columns describe overlapping state; users must reconcile "To Be Paid" (status) with "Queued for Payout" (stage) that mean nearly the same thing.
- **Business impact:** Ambiguity in financial state invites misreads of the ledger.
- **Evidence:** `reimbursements/page.tsx` `paymentStage()` helper + column render.
- **Recommended principle:** One source of truth per dimension; do not show a derived pipeline column alongside the canonical status (state clarity).

### 5.3 Financial components are consistent and well-built (positive)

- **Evidence:** `FinancialWorkflowHeader`, `FinancialSummaryCards` (tone-driven, AA-compliant), `FinancialNextAction`, `FinancialExceptionBanner`, `FinancialRecordLink`, `SuccessBanner` form a coherent, documented set.
- **Assessment:** The component vocabulary is sound and should be carried into the rebuild; the defects are in *how pages compose* them, not in the components themselves.

---

## 6. Claims Page — Table & Columns Audit

### 6.1 Column set is dense and status-heavy

- **Problem:** The table mixes identity columns (claim number, employee, clinic), status, derived payment stage, and amount, with no clear column prioritization for the billing task.
- **User impact:** Scanning for "approved and not yet invoiced" requires holding three columns in working memory across rows.
- **Business impact:** Slow, error-prone selection in the core workflow.
- **Recommended principle:** Order and emphasize columns by the current task; add an explicit **Invoice status** column (§11, §18).

### 6.2 Search does not cover what an admin types

- **Problem:** Backend claim search matches `claimNumber`, `description`, `employeeName`, `type` — but not `clinicName` or `tenantName`, two of the most likely admin queries when scoping by organization or clinic.
- **User impact:** Typing an organization or clinic name returns nothing, making the user doubt the tool.
- **Business impact:** Friction in the organization-scoping step of billing.
- **Evidence:** `reimbursementsRepository.ts` search `$or` fields.
- **Recommended principle:** Search should match the fields the surface displays and the entities the user scopes by.

---

## 7. Claims Page — Status & Pipeline UX Audit

### 7.1 The claim status machine is not legible to the Super Admin

- **Problem:** Claims expose `pending | in_progress | approved | to_be_paid | rejected | frozen | paid`. The meanings of `in_progress` vs. `pending`, and the exact trigger for `to_be_paid`, are not explained in the UI.
- **User impact:** The admin must infer the pipeline from observed data rather than from a legend.
- **Business impact:** Misunderstanding `to_be_paid` (it means "org has paid, awaiting clinic payout") vs. `approved` (invoiceable) drives most of the confusion in this flow.
- **Evidence:** `STATUS_CONFIG` in `reimbursements/page.tsx`; `documents.ts` claim status union.
- **Recommended principle:** Provide an inline status legend / glossary tied to the state machine; use plain-language labels.

### 7.2 `generated` invoice status is a dead branch that leaks into the UI

- **Problem:** The invoice status union is `draft | generated | issued | paid | archived`, but `generateInvoice` always creates `draft` and no code path ever sets `generated`. The admin filter dropdowns still reference a status that can never occur.
- **User impact:** A filter option that always yields zero results; a status the user may expect to see but never will.
- **Business impact:** A phantom state in a financial model is a latent bug and a trust leak.
- **Evidence:** `invoiceService.ts` `generateInvoice` → `status: "draft"` (line 295); `issueInvoice` accepts `["draft","generated"]` (line 383); no assignment to `generated` anywhere.
- **Recommended principle:** Remove the dead state (or implement it deliberately); never expose statuses the system cannot produce.

---

## 8. Claims Page — Summary Cards / KPI Audit

### 8.1 KPI counts are page-scoped while the total is full-scoped

- **Problem:** The `stats` memo iterates over the **current page** of claims (25 rows) to compute per-status counts and amounts, but sets `total` from the API's full `total`. So "Approved: 3 · $450" reflects only the visible page, while "Total: 1,204" reflects everything.
- **User impact:** Per-status numbers are silently wrong whenever there are more than 25 claims; the admin cannot trust the summary to size the workload.
- **Business impact:** Incorrect financial summaries are a reporting hazard.
- **Evidence:** `reimbursements/page.tsx` `stats` useMemo (`s.total = total` vs. iteration over page rows).
- **Recommended principle:** Summary metrics must be computed server-side or over the full dataset, never a page slice (data accuracy over visual convenience). The backend already exposes `aggregateByStatus`; use it.

---

## 9. Organization-Aware Selection Audit — **Critical gap**

- **Problem:** There is **no organization selector** anywhere in the Claims→Invoices flow. The confirmed model begins with "Choose Organization," but the Super Admin has no first-class control to scope claims by organization before selecting them. The Invoices page implicitly groups by organization *after* the fact, but Claims offers only an optional tenant filter buried in filters — not a guided "choose org" step.
- **User impact:** The very first step of the client's model is missing; the user cannot perform the flow as specified.
- **Business impact:** Invoices can be generated for the wrong organization (the backend takes a bare `tenantId` with no UI reinforcement), or the admin works around the missing step manually.
- **Evidence:** No `OrganizationSelector`-like control in `reimbursements/page.tsx`; the only org affordance is a tenant filter; `generateInvoice` takes `tenantId` with no selection UX.
- **Recommended principle:** A guided flow must begin with an explicit organization choice (progressive disclosure, single primary CTA). Proposed component: **OrganizationSelector** (§18).

---

## 10. Bulk Actions & Invoice-Generation Audit — **Critical gap**

### 10.1 Generation is date-range based, not selection-based

- **Problem:** The backend `GenerateInvoiceInput` is `{ tenantId, from, to, generatedBy }`. The Generate Invoice modal asks for Organization + From/To dates, then scoops **every** approved claim whose service date falls in the window and that isn't already on an invoice. There is no way to pick individual claims, select all, or remove claims.
- **User impact:** The Super Admin cannot produce an invoice for a *subset* of approved claims without manipulating service dates — which is not a valid proxy for selection.
- **Business impact:** This directly violates client requirements #1 (individual selection), #2 (select all), and #5 (remove claims). It is the single largest gap between the product and the confirmed model.
- **Evidence:** `invoiceService.ts` `generateInvoice` (lines 224–312); `generate/route.ts` requires only `tenantId, from, to`; modal in `invoices/page.tsx`.
- **Recommended principle:** Selection must be explicit and user-controlled; generation is the *consequence* of a selection, not of a date range. This is the core of the §18 rebuild.

### 10.2 Three competing "Generate Invoice" CTAs

- **Problem:** The Invoices page offers Generate Invoice in the header, in a "Ready for invoicing" banner, and in the empty state — three entry points for the same date-based modal.
- **User impact:** Multiple primary actions violate the "one primary CTA per screen" rule and add noise.
- **Business impact:** Redundant CTAs suggest functionality that doesn't exist (selection-based generation).
- **Evidence:** `invoices/page.tsx` header/banner/empty-state buttons.
- **Recommended principle:** One primary CTA per screen (primary-action); secondary affordances should be subordinate.

### 10.3 The bulk bar is a navigation hint, not an action

- **Problem:** On Claims, selecting rows reveals a "Draft Invoice (N · $amount)" bar, but the button merely navigates to `/invoices` with a query string that the target page ignores (§4.2). No invoice is drafted; no selection is retained.
- **User impact:** A bulk action that does nothing but navigate (and lose the selection) is worse than no bulk action.
- **Business impact:** The appearance of a selection-to-invoice capability that does not function.
- **Evidence:** `reimbursements/page.tsx` bulk bar + `goToInvoiceDraft`.
- **Recommended principle:** A bulk action must perform or stage its stated action; never a disguised link.

### 10.4 Selection silently clears on filter and page change

- **Problem:** A `useEffect` resets `selectedIds` on `statusFilter`, `tenantFilter`, `searchFilter`, and `skip` change. Selecting claims, then changing any filter or paginating, silently deselects everything.
- **User impact:** A long multi-select is destroyed by an incidental filter tweak, with no warning.
- **Business impact:** The client's "select all / bulk" workflow is undermined by accidental selection loss.
- **Evidence:** `reimbursements/page.tsx` `useEffect(() => setSelectedIds(new Set()), [statusFilter, tenantFilter, searchFilter, skip])`.
- **Recommended principle:** Preserve selection across filters, or explicitly confirm before clearing; surface the current selection count persistently.

---

## 11. Invoice Eligibility & Approved-vs-Invoiced Distinction — **Critical gap**

- **Problem:** Claims are **never modified** by invoicing. The double-invoicing guard is computed at generate time by scanning existing invoice line items for `claimId`. Consequently a claim that sits on a draft or issued invoice still reads `approved`, and the Claims API returns **no invoice-linkage field**. The Super Admin cannot tell, from Claims, which `approved` claims are still invoiceable.
- **User impact:** The admin sees a pool of "approved" claims and cannot distinguish "ready to invoice" from "already on an invoice." This makes requirement #6 (clear approved/invoiced distinction) unfulfillable in the current UI.
- **Business impact:** High risk of either double-invoicing (if the guard were removed) or of the admin attempting to re-invoice and being blocked by the backend's `NO_CLAIMS_TO_INVOICE` error with no UI explanation.
- **Evidence:** `invoiceService.ts` guard (lines 232–264); no `invoiced`/`invoiceId` field on `ReimbursementDocument` (`documents.ts` line 211); `admin/reimbursements/route.ts` mapped response has no linkage field; `admin/reimbursements/[id]/route.ts` likewise.
- **Recommended principle:** The claim's financial relationship must be first-class. Either (a) stamp an `invoiced`/`invoiceId` marker on the claim at generate time, or (b) the admin list/detail endpoint must join invoice line items to expose "On invoice: INV-…". This is a backend contract change — flagged as out of scope for *this* phase but required before the UI can meet req. #6.

### 11.1 Claim detail cannot show its invoice relationship

- **Problem:** Claim detail discovers invoice linkage only through `/api/super-admin/payments/<claimId>`, which returns a payment record **only when the claim is queued/paid**. An `approved` claim on a draft/issued invoice shows no invoice relationship at all.
- **User impact:** The admin opens an approved claim and sees no trace of the invoice it belongs to.
- **Business impact:** Requirement #9 (clear financial relationships) is broken for the most common case.
- **Evidence:** `reimbursements/[id]/page.tsx` invoice linkage; `payments/[claimId]` returns only queued/paid records.
- **Recommended principle:** A claim's invoice relationship should be visible from claim detail regardless of payment stage. Proposed component: **FinancialTimeline** enriched with invoice events (§18).

---

## 12. Invoices ("Billing Workspace") Page Audit

### 12.1 No first-class invoice list

- **Problem:** The page is an org-first ledger; individual invoices appear only as a drill-down under a selected organization. There is no browsable, filterable invoice history across all organizations.
- **User impact:** Requirement #8 (invoice history) is only partially met — you can find an invoice if you know its organization, but not by invoice number across the estate.
- **Business impact:** Reconciliation and audit are harder than they should be.
- **Evidence:** `invoices/page.tsx` (org table + `selectedOrg` drill-down); `getArLedger`.
- **Recommended principle:** Provide both an org-first receivable view **and** a flat invoice-history list (§18).

### 12.2 Destructive actions execute without confirmation

- **Problem:** `runAction` (issue / mark-paid / archive) fires immediately with no confirmation dialog.
- **User impact:** A single mis-click on "Issue" or "Mark Paid" commits an irreversible financial state change.
- **Business impact:** Financial actions without a confirm step are an audit/compliance hazard.
- **Evidence:** `invoices/page.tsx` `runAction`; `invoices/[id]/page.tsx` action buttons with no confirmation.
- **Recommended principle:** Confirm before destructive/irreversible actions (confirmation dialogs); show a clear success state after.

### 12.3 Status filter is inconsistent

- **Problem:** The per-invoice status filter dropdown omits the `generated` status present in the invoice status config, an inconsistency (and moot, since `generated` is a dead state — §7.2).
- **User impact:** A filter surface that disagrees with the status model.
- **Business impact:** Cosmetic, but symptomatic of the dead-state problem.
- **Evidence:** `invoices/page.tsx` `PAYMENT_STATUS_CONFIG` vs. `AR_STATUS_CONFIG`.
- **Recommended principle:** Filters must mirror the actual status model exactly.

---

## 13. Invoice Draft & Review Audit

- **Problem:** There is no draft *review* surface. A generated invoice is created as `draft` and can be issued, but there is no read-only "here is exactly what will be sent, confirm before issuing" state. Requirement #7 (review before issuing) is nominally possible (draft exists) but not guided.
- **User impact:** The admin issues an invoice without a deliberate review checkpoint, relying on the detail page's line items alone.
- **Business impact:** The client's "review then issue" expectation is under-served; errors on an issued invoice are costly to unwind.
- **Evidence:** Invoice status `draft` exists (`invoiceService.ts` line 295), but the UI offers "Issue" directly from the draft without a distinct review step.
- **Recommended principle:** Explicit review-then-issue checkpoint (multi-step progress / confirmation). Proposed components: **InvoiceDraft** and **InvoiceReview** (§18).

---

## 14. Invoice Detail & History Audit

### 14.1 Printable invoice omits employee identity

- **Problem:** `PrintableInvoice` line items show claim number, clinic, amount, session count, service date — but not the employee. `InvoiceLineItem` carries no employee name, so this is a data-model limitation, not just a render omission.
- **User impact:** The recipient (organization) may need employee identity to reconcile the invoice against claims.
- **Business impact:** If employee identity is required on vendor-facing invoices, the line-item schema must be extended (back-end change; flagged §19).
- **Evidence:** `InvoiceLineItem` fields (`documents.ts` lines 403–413); `invoices/[id]/page.tsx` `PrintableInvoice`.
- **Recommended principle:** The document's audience and required fields should be defined first; then render faithfully (§19 open question).

### 14.2 No confirmation on invoice-detail actions

- **Problem:** Issue / Mark Paid / Archive / Export actions on invoice detail run without confirmation (same defect as §12.2).
- **User impact:** Irreversible transitions are one click away.
- **Business impact:** Same compliance hazard.
- **Evidence:** `invoices/[id]/page.tsx` action handlers.
- **Recommended principle:** Confirm irreversible financial transitions.

---

## 15. Claim Detail & Financial Timeline Audit

### 15.1 Two timelines describe overlapping history

- **Problem:** Claim detail renders both `ClaimTimeline` (status history) and `FinancialTimeline` (payment-pipeline milestones derived from history notes). The two can appear redundant.
- **User impact:** The admin must reconcile two timelines to understand one claim's life.
- **Business impact:** The `FinancialTimeline` is the more decision-relevant surface; the status timeline adds noise.
- **Evidence:** `reimbursements/[id]/page.tsx`; `ClaimTimeline.tsx`; `FinancialTimeline.tsx`.
- **Recommended principle:** One consolidated financial timeline with clearly typed events (status change, invoiced, issued, paid), rather than two parallel timelines. Proposed component: **FinancialTimeline** (§18).

### 15.2 Status-guidance banners route the user away from the flow

- **Problem:** Approved claims show "Go To Invoices"; `to_be_paid` shows "Go To Payments." These route by status rather than by the user's task, and the "Go To Invoices" link lands on the org ledger (§4.2/§12), not a pre-scoped draft.
- **User impact:** Guidance that sends the user to a destination that cannot honor their context.
- **Business impact:** Reinforces the broken deep-link problem.
- **Evidence:** `reimbursements/[id]/page.tsx` status banners.
- **Recommended principle:** Guidance should carry context to a destination that can act on it (§18).

---

## 16. Cross-Page UX & Deep-Link Audit

Summary of cross-page defects (each detailed above):

- **Claims → Invoices** deep link loses `tenantId` + `claims` (§4.2).
- **Claim detail → Invoices** "Go To Invoices" does not pre-scope an invoice (§15.2).
- **Claim ↔ Invoice ↔ Payment** relationships are only partially visible: claim → payment is visible only after payout, and claim → invoice is invisible (§11.1).
- **No shared "financial record" navigation** — `FinancialRecordLink` exists (kind: invoice/claim/payment) but is not wired into the primary surfaces to cross-link claim↔invoice↔payment.

**Recommended principle:** Financial entities must be cross-linked in both directions (clear financial relationships, req. #9). The rebuild should thread `FinancialRecordLink` throughout (§18).

---

## 17. Technical / Data-Model Audit

### 17.1 The backend flow is sound; the UI is the gap

- **Assessment:** The TenantApp backend implements a correct financial sequence: generate → `draft`, issue → `issued`, mark-paid → `paid` + `queueForPayment` (approved → `to_be_paid`), archive. A/R ledger treats only `issued` invoices as receivable, ages from issue date, marks overdue >30d, and computes "Paid This Month" from `paidAt`. This is defensible.
- **Evidence:** `invoiceService.ts` (generate/issue/markPaid/archive/getArLedger); `markInvoicePaid` note (lines 306–311, 421–433).

### 17.2 Required backend changes (out of scope this phase, but gating)

- **Claim-selection-based generation:** `GenerateInvoiceInput` must accept an explicit `claimIds` list (or the UI must create a draft whose line items are the selection). Currently impossible (§10.1).
- **Invoice linkage on claims:** Add `invoiced`/`invoiceId` marker to `ReimbursementDocument`, or join invoice line items in the admin claim list/detail endpoints (§11).
- **Employee identity on line items:** If required on printed invoices, extend `InvoiceLineItem` (§14.1).
- **Dead `generated` status:** Remove from the union or implement it deliberately (§7.2).
- **Search coverage:** Add `clinicName`/`tenantName` to claim search (§6.2).
- **Server-side status aggregates:** Expose `aggregateByStatus` to the admin so KPIs are full-scope (§8.1).

### 17.3 The admin layer is a thin proxy

- **Assessment:** Admin API routes forward to TenantApp with `x-admin-api-key`. The frontend holds state locally (useState/useEffect/useMemo). This is clean but means the frontend currently computes summary/selection logic that would be safer server-side.

---

## 18. Target Information Architecture & Proposed Components

**Target IA (single guided flow):**

```
Claims (workspace)                          Invoices (workspace)
├─ OrganizationSelector                      ├─ Generate (guided, from Claims selection)
├─ ClaimsSummary (3–4 decision cards)        ├─ InvoiceHistory (flat, filterable list)
├─ ClaimsFilters                             └─ Receivables (org-first A/R ledger)
├─ ClaimsTable  ──► ClaimSelectionToolbar
└─ BillingReadiness (approved & not invoiced)
        │
        └── Generate Invoice ──► InvoiceDraft ──► InvoiceReview ──► Issue ──► Await org payment
```

**Proposed components (design names only — NOT to be created in this phase):**

| Component | Purpose |
|---|---|
| `OrganizationSelector` | Explicit "choose organization" step that scopes all downstream selection |
| `ClaimsSummary` | 3–4 decision cards: Eligible-to-invoice, In-progress, Awaiting-payout, Paid-this-period |
| `ClaimsFilters` | Unified filter surface (org, status, search incl. clinic/org name) |
| `ClaimsTable` | Priority-ordered columns incl. an **Invoice status** column |
| `ClaimSelectionToolbar` | Persistent selection bar (Select All / Remove / count + amount) that survives filters |
| `BillingReadiness` | The "approved & not invoiced" pool — the invoiceable set |
| `InvoiceSelectionSummary` | Read-only summary of the selection before generation |
| `InvoiceDraft` | Draft line-item view with add/remove |
| `InvoiceReview` | Read-only "confirm before issuing" checkpoint |
| `InvoiceHistory` | Flat, filterable invoice list across all organizations |
| `FinancialTimeline` | One consolidated timeline with typed events (status/invoiced/issued/paid) |

These replace the current ad-hoc composition while preserving the existing financial component vocabulary (§5.3).

---

## 19. Risks, Unknowns & Open Questions

**Risks (if rebuilt without resolving the below):**

1. Implementing selection-based invoicing requires a **backend contract change** (`claimIds` on generate). Building the UI first would produce a non-functional flow.
2. Adding invoice linkage to claims touches the **claim document schema** and the admin claim endpoints — a cross-cutting change that must be sequenced with the reimbursement service.
3. Restoring "Invoices" to the sidebar reverses a prior "Phase B" decision; this should be re-confirmed with stakeholders, since the current demotion was deliberate.

**Open questions (from `CLIENT_CLARIFICATION_MASTER.md`, still unresolved and blocking some UI decisions):**

- **Q18b** — Is a distinct `invoiced` claim status needed, or is invoice-linkage a field on the claim? (Determines §11 implementation.)
- **Q28** — Vendor invoice flow: is it (b) "Remedy invoices org → org pays → Remedy reimburses employee" (the current implementation) or another model? (Confirms the mental model.)
- **Q30a** — Invoicing cadence: monthly/quarterly/per-claim? (Affects whether date-range generation is ever desired alongside selection.)
- **Q69** — Is `serviceDate` the service-rendered date or the invoice date? (Affects date-range generation semantics.)
- **Employee identity on printed invoices** — required or not? (Affects §14.1 schema.)

**Unknowns requiring confirmation before rebuild:**

- Whether organization-level invoice consolidation (one invoice per org per period) vs. per-claim invoicing is the default.
- The exact meaning of `in_progress` vs. `pending` that should be surfaced to the Super Admin.
- Whether the Super Admin needs the ability to *edit* a draft's line items after generation (the client asked for remove-before-generate, not post-generation editing).

---

*End of Phase 1A audit. No code, components, routes, API contracts, state transitions, database changes, or refactors were performed. Proposed component names are design intentions only.*
