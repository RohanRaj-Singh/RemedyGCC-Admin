# Claims → Invoice Business Workflow Specification

**Phase 1B — Architecture & business workflow lock. No implementation.**
**Purpose:** Resolve the remaining business/architecture ambiguities before rebuilding the Claims + Invoices UI, so we do not rebuild twice.
**Date:** 2026-08-26

---

## 1. Scope

This specification locks the business and architectural semantics of the **Claims → Invoice** portion of the Super Admin financial workflow. It is scoped to:

- Claim eligibility for invoicing
- The claim ↔ invoice relationship
- Organization/invoice grouping
- Claim selection and bulk billing
- The invoice creation lifecycle (Generate → Review → Issue)
- Invoice date semantics
- Invoice contents
- Invoice history / navigation
- Financial traceability (claim ↔ invoice ↔ payment)
- The organization-payment → payout transition
- Edge-case behavior

**Out of scope (unchanged, authoritative):**
- The claim payment state machine (`approved → to_be_paid → paid`) — **not changed**
- Tenant-admin claim-review permissions (approve/reject/freeze/move-to-in-progress) — **Super Admin does not gain these**
- Payments workspace implementation details (referenced only at the boundary)
- Authentication, authorization, payment processing, caching
- The SaaS visual redesign (deferred — see final section)

This document produces decisions, not code.

---

## 2. Client-confirmed requirements

The following are **confirmed** client requirements (from the completed UX/UI audit and the product direction). These are treated as authoritative product intent:

1. Two primary operational workspaces: **Claims** and **Payments**.
2. Invoices remain an important **business object, billing workflow, and historical record** — but not a third "unrelated application."
3. The financial workflow is:

   ```
   Claims → Select Organization → Identify eligible/approved claims → Select claims
   → Generate Invoice → Review Invoice → Issue Invoice → Await Organization Payment
   → Organization Payment Recorded → Claims become ready for payout → Payments
   ```

4. The claim payment state machine `approved → to_be_paid → paid` is **finalized and authoritative**.
5. The Super Admin does **not** gain tenant-admin claim-review powers (approve, reject, freeze, move to in-progress).
6. **Individual claim selection** is required when building an invoice.
7. **Select All** eligible claims in one action.
8. **Bulk invoice generation** from a selection.
9. **Organization-aware selection** — the invoice is always scoped to one organization.
10. **Ability to remove claims** from an invoice selection.
11. **Clear approved vs. invoiced distinction** — the admin always knows which approved claims are still invoiceable.
12. **Invoice review before issuing.**
13. **Invoice history.**
14. **Clear financial relationships** (claim ↔ invoice ↔ payment).
15. **Minimal unnecessary navigation**, and a **"simple guided experience" without removing Super Admin power.**

---

## 3. Existing finalized architecture

The following are **authoritative facts** established by the current TenantApp backend and confirmed by the prior audit. Where a decision below relies on these, they are cited as `SOURCE: architecture`.

### 3.1 Claim model (`ReimbursementDocument`)

- `status ∈ { pending, in_progress, approved, to_be_paid, rejected, frozen, paid }`
- The claim is the **legal financial record**: it carries an immutable bank snapshot (`bankAccountNumber`, `bankName`), `clinicId`/`clinicName`, `employeeId`/`employeeName`, `amount`, `sessionCount`, `serviceDate`, and a `history` array.
- **There is no `invoiced` or `invoiceId` field on the claim.** Claims are never modified by the invoicing step.

### 3.2 Invoice model (`InvoiceDocument`)

- `status ∈ { draft, generated, issued, paid, archived }` — **`generated` is a dead state**: `generateInvoice` always creates `draft`, and no code path sets `generated`.
- `tenantId` is a **scalar** — one invoice belongs to exactly one organization.
- `lineItems[]` — each item snapshots `claimId`, `claimNumber`, `clinicName`, `amount`, `sessionCount`, `serviceDate`, and the claim's bank snapshot. **`employeeName` is not carried on line items.**
- `period { from, to }`, `generatedAt`, `issuedAt`, `paidAt`, `totalAmount`.

### 3.3 Invoice generation (current)

- `generateInvoice({ tenantId, from, to, generatedBy })`:
  - Filters approved claims by `serviceDate ∈ [from, to]`.
  - Excludes claims already referenced by any existing invoice line item (double-invoicing guard).
  - Creates a **`draft`** invoice; does **not** change claim status.
- **This is date-range based, not selection-based.** It is the primary defect this specification resolves.

### 3.4 Invoice state transitions

- Issue: `draft | generated → issued` (sets `issuedAt`).
- Mark paid: `issued → paid` (sets `paidAt`), then queues each linked **approved** claim `approved → to_be_paid`.
- Archive: `draft | paid → archived`.

### 3.5 Payment records (`PaymentRecordDocument`)

- `status ∈ { to_be_paid, paid }`; `claimId` has a **unique index** (one record per claim).
- Fields: `tenantId`, `claimId`, `invoiceId?`, `clinicId/clinicName`, `amount`, `paymentReference?`, `bankReference?`, `notes?`, `paidAt?`, `paidBy?`, `method?`.
- Written at queue time (`to_be_paid`), finalized at payout (`paid`).

### 3.6 The full financial sequence (confirmed correct)

```
Invoice issued
  → org pays externally (off-platform)
  → Super Admin records organization payment  →  invoice `issued → paid`  (+ paidAt/paidBy)
  → linked approved claims auto-queue          →  claim `approved → to_be_paid`  (+ PaymentRecord, invoiceId)
  → Payments workspace (payout queue)
  → external clinic/employee payment executed
  → Super Admin records payout                 →  claim `to_be_paid → paid`  (+ PaymentRecord finalized)
```

### 3.7 Tenant anonymity layer

- Tenant-admin claim endpoints **deliberately strip `employeeName`**. This is an existing anonymity design decision that bears on invoice contents (§10).

---

## 4. Claim eligibility rule

### 4.1 The precise rule

```
ELIGIBLE FOR INVOICE =
      claim.status == "approved"
  AND claim is NOT already referenced by any existing invoice line item
        (draft, generated, issued, paid, or archived)

NOT ELIGIBLE =
      claim.status ∈ { pending, in_progress, rejected, frozen, to_be_paid, paid }
  OR  claim is already referenced by an existing invoice line item
```

### 4.2 Notes

- **Organization matters:** eligibility is always computed **within a single selected organization** (an invoice is org-scoped, §6).
- **`serviceDate` is not an eligibility condition.** Under the selection model, a claim with no `serviceDate` is still invoiceable if `approved` and not already invoiced (service date is display/metadata only, §9). This is a **deliberate change** from the current date-window implementation.
- **`frozen` is not eligible.** Frozen is a fraud/dispute/budget hold and is not "approved."
- **`to_be_paid` / `paid` are not eligible** — they are already past the billing stage (already invoiced and either queued for payout or paid out).

### 4.3 Usable by both layers

This rule must be implemented identically by backend and frontend. The backend remains the **authoritative enforcer** (it rejects generation of ineligible claims); the frontend **pre-computes** the same rule to drive selection affordances and prevent invalid selections before a request is made.

---

## 5. Claim status vs invoice relationship

### 5.1 Recommendation: **B — a separate financial relationship, not a claim status**

**DECISION:** "Invoiced" is **not** a claim status. It is a **financial relationship** — the fact that a claim is referenced by an invoice's line items. The claim's own `status` continues to mean only its review/payment lifecycle; the invoice relationship is tracked separately.

**RATIONALE:**

- The claim status machine `approved → to_be_paid → paid` is finalized and must not change. Inserting an `invoiced` state would break it and would wrongly imply that a claim "leaves" `approved` the moment it is billed — but a billed, unpaid claim is still `approved` and must remain so until the org pays.
- The two concepts have different lifecycles and different owners:
  - **Claim status** answers "what is the review/payout state of this claim?" (approved → to_be_paid → paid).
  - **Invoice relationship** answers "has this claim been bundled into an invoice, and which one?" (not-invoiced → on-draft → issued → org-paid).
- The existing data model already encodes this: the claim document is never mutated by invoicing; the relationship lives in the invoice's `lineItems` (invoice → claims) and the `PaymentRecord.invoiceId` (claim → funding invoice, post-payout).

**SOURCE:** finalized claim state machine (architecture); `ReimbursementDocument` has no invoicing field; `InvoiceLineItem.claimId` and `PaymentRecord.invoiceId` carry the relationship.

**IMPACT ON IMPLEMENTATION:** No new claim status. The relationship must be made **queryable in the claim direction** so the admin can see, from a claim, whether and where it is invoiced. See §5.3.

### 5.2 How an approved claim becomes associated with an invoice

1. At **Generate** time, the draft invoice's `lineItems[]` reference the selected claims by `claimId`. This is the point the relationship begins. The claim's `status` is **unchanged** (still `approved`).
2. At **Issue** time, the org is billed; the relationship is unchanged (claims still `approved`).
3. At **Organization payment** time (`markInvoicePaid`), each linked **approved** claim transitions `approved → to_be_paid` and a `PaymentRecord` is written carrying `invoiceId`. The relationship is now also visible via the payment record.

### 5.3 How the UI determines eligibility

The UI determines "eligible for invoicing" as `status == "approved"` **and** "no invoice relationship." To compute "no invoice relationship" without scanning every invoice on the client, the backend must expose the relationship. Two options (implementation detail, resolved in the rebuild phase):

- **(a) Join at read time:** the admin claim list/detail endpoint returns a derived `invoiceId`/`invoiceNumber` (or `invoiced: boolean`) by joining invoice line items.
- **(b) Denormalize:** add a nullable `invoiceId` field to the claim, set at Generate time and cleared if the draft is archived before issue.

Both are acceptable; **(a)** is preferred because it keeps the claim immutable (the source of truth for the relationship remains the invoice) and avoids a new mutation surface.

### 5.4 How duplicate invoicing is prevented

- **Backend (authoritative):** at Generate time, the service collects `claimId`s already present on any existing invoice line item for the tenant and excludes/rejects them. This guard must remain regardless of any UI changes.
- **Frontend (prevention):** the claims table marks already-invoiced claims and disables their selection, so the admin cannot select them in the first place.
- **Historical preservation:** invoice line items are an immutable snapshot. Even if a claim is later edited, the invoice preserves exactly what was billed.

---

## 6. Organization / invoice grouping

### 6.1 The grouping model

**DECISION:** One invoice contains claims from **exactly one organization** and **may span multiple clinics** within that organization.

```
One organization (invoice.tenantId)
  ├── Clinic A  ─┐
  ├── Clinic B  ─┼─  one invoice
  └── Clinic C  ─┘
```

**RATIONALE:**

- The data model is already org-scoped: `InvoiceDocument.tenantId` is a scalar. Multiple organizations cannot share an invoice without a schema change that nothing in the confirmed requirements calls for.
- The client's confirmed model ("Select Organization … select claims … Generate Invoice") is inherently single-org.
- Line items already carry per-claim `clinicId`/`clinicName`, so a single invoice can naturally list claims from multiple clinics of the same org.

**SOURCE:** architecture (`InvoiceDocument.tenantId` scalar; per-line-item `clinicName`); confirmed workflow ("Select Organization" is step one).

**IMPACT ON IMPLEMENTATION:** The invoice-generation input is `{ organizationId, claimIds }`. Grouping by clinic is a **display concern**, not a billing boundary.

### 6.2 Behavior when the Super Admin selects across organizations

- The billing selection is **always scoped to the organization chosen in the OrganizationSelector**.
- The Claims table, when in "billing" mode, shows **only the selected organization's claims**, so cross-organization selection is structurally impossible rather than an error.
- If, through navigation or a stale view, a selection attempts to cross organizations, the UI must **prevent it** (disable/clear out-of-scope selections) — never silently merge two organizations into one invoice.

---

## 7. Claim selection and bulk billing

### 7.1 Filtering vs. billing selection (the governing distinction)

| Concept | Meaning | Drives |
|---|---|---|
| **Filtering** | Narrows what is *displayed* (status, search, org, clinic, date range) | The claims table |
| **Billing selection** | The explicit, claim-level choice of what will be *invoiced* | Invoice contents |

**These must never be conflated.** Changing a filter must not change the billing selection, and applying a date range must not imply that claims are "selected."

### 7.2 Decisions

**DECISION: Explicit claim selection is required.** An invoice can never be generated without an explicit selection of claims.

**DECISION: Date range is a filter only.** It never automatically determines invoice contents (see §9, §14).

**DECISION: "Select All" means all eligible claims in the current organization + filter context** (not "all claims" globally, and never across organizations).

**DECISION: The Super Admin can remove claims from a selection at any time before invoice creation** (and, recommended, while the invoice is a draft — see §8.3).

**DECISION: The Super Admin can add claims while the invoice is a draft** (pre-issue). This is a **recommendation** consistent with "draft is editable"; the client has not explicitly confirmed post-generation editing, so it is flagged in §16.

**DECISION: If a selected claim becomes ineligible before creation** (e.g., concurrently invoiced by another admin), the backend rejects it at Generate time and the UI surfaces **which claims were excluded and why** — the invoice is not silently created with fewer claims than selected.

**SOURCE:** client-confirmed requirements #6–#10, #15.

**IMPACT ON IMPLEMENTATION:** The selection is a first-class client state (persistent across filters), distinct from any display filter. The backend generation endpoint takes an explicit `claimIds` list.

---

## 8. Invoice creation lifecycle

### 8.1 The conceptual workflow

```
Select claims → Generate Draft → Review → Issue
```

### 8.2 Action definitions

| Action | Meaning | Invoice status | Claim status |
|---|---|---|---|
| **Generate** | Create a **draft** invoice from the selected claims | `(none) → draft` | unchanged (`approved`) |
| **Review** | Read-only confirmation of the draft's line items and total | `draft` | unchanged |
| **Issue** | Finalize and send the invoice to the organization | `draft → issued` | unchanged (until org pays) |

### 8.3 Decisions

**DECISION: Generate creates a draft record** (matches the existing backend, which creates `draft`).

**DECISION: A draft can be edited** (add/remove claims, adjust) before issue. This is recommended and consistent with the "draft" concept, but note the current backend has **no draft-edit endpoint** (only generate/issue/pay/archive) — flagged as an implementation implication, not a business blocker.

**DECISION: Claims can be removed from a draft.** Consistent with the client's "remove claims" requirement.

**DECISION: Claims can be added to a draft.** Recommended; unconfirmed by the client (§16).

**DECISION: A claim is considered "invoiced" (associated with an invoice) at Generate time** — the moment it appears in a draft's line items. Its `status` remains `approved`.

**DECISION: Issuing is the point at which the organization receives/billed the invoice** (`issuedAt` is the invoice date; §9).

**DECISION: A draft can be abandoned** by archiving it (`draft → archived` is already a legal transition). Abandoning a draft does **not** change any claim's status.

**DECISION: An issued invoice cannot be edited.** The only transitions from `issued` are `→ paid` and `→ archived` (post-payment). This matches the existing state machine.

**SOURCE:** architecture (invoice transitions); client requirements #7, #10, #12.

**IMPACT ON IMPLEMENTATION:** The rebuild must surface four lifecycle actions — Generate, Review, Issue, Archive — with the edit surface (add/remove) available only while `draft`. The `generated` dead state should be removed from the model or implemented deliberately (§14, §15).

---

## 9. Invoice date semantics

### 9.1 The dates

| Date | Field | Meaning | Role |
|---|---|---|---|
| Claim submission date | `createdAt` | When the claim was created | Filter (optional) |
| Service date | `serviceDate` | When the service was rendered (optional) | **Display/metadata only** |
| Invoice generated | `generatedAt` | When the draft was created | Invoice metadata |
| Invoice date (issued) | `issuedAt` | When the invoice was sent/billed | Invoice metadata |
| Billing period | `period.from / period.to` | The period the invoice nominally covers | Invoice metadata |

### 9.2 Role assignments

1. **Used for filtering:** `createdAt` (submission-date filter), and optionally `serviceDate` (a display/navigation filter). Neither drives selection.
2. **Used for invoice metadata:** `generatedAt`, `issuedAt`, `period`, `invoiceNumber`.
3. **Used for grouping:** **none.** Grouping is by organization (and, for display, clinic) — never by date.
4. **Used for eligibility:** **none.** Eligibility is `status == approved` **and** not already invoiced (§4).
5. **NOT used for automatic claim selection:** `serviceDate` and `createdAt` must never auto-select claims.

### 9.3 Open question

- **`serviceDate` semantics** (`CLIENT_CLARIFICATION_MASTER.md` Q69): is it the service-rendered date or the invoice date? The backend treats it as a per-claim service date; the client has not fully resolved it. For billing it is **not** a driver either way, so this does not block the workflow — it only affects a label in the claims table and invoice line item. Flagged in §16.

---

## 10. Invoice contents

### 10.1 Required on the invoice (organization-facing)

- **Organization** (billed party — tenant name)
- **Invoice number** (`invoiceNumber`)
- **Invoice date** (`issuedAt`)
- **Billing period** (`period.from`–`period.to`)
- **Line items**, each: claim reference (`claimNumber`), clinic name (`clinicName`), amount, number of sessions (`sessionCount`), service date (`serviceDate`)
- **Total amount**

### 10.2 Required only in the Super Admin UI (not on the printed invoice)

- **Employee identity** (`employeeName`) — visible to Super Admin, **not** on the org-facing invoice.
- **Bank/account details** (`bankAccountNumber`, `bankName`) — the claim's immutable payout snapshot, visible only in the Super Admin UI for payout traceability, **not** on the org-facing invoice.

### 10.3 Not required

- Receipt URL/hash, internal notes, claim history, internal reviewer/actor fields.

### 10.4 Employee identity — explicit resolution

**DECISION: Employee identity is NOT placed on the organization-facing invoice.** It remains visible in the Super Admin UI (and on the claim detail) but is excluded from the printed invoice.

**RATIONALE:** The existing tenant-anonymity layer already strips `employeeName` from tenant-admin-facing claim endpoints. The organization is, in this model, the paying party in a tenant-admin context; carrying employee identity onto the org-facing invoice would contradict the existing anonymity design. This is a decision grounded in existing architecture, not implementation convenience.

**SOURCE:** architecture (`InvoiceLineItem` has no `employeeName`; tenant-admin endpoints strip `employeeName`).

**IMPACT ON IMPLEMENTATION:** No schema change to `InvoiceLineItem` is required for employee identity. The Super Admin invoice detail should, however, show employee identity by joining claim data at display time if the admin needs it.

---

## 11. Invoice history / navigation model

### 11.1 Recommendation: **Option B**

**DECISION:** Keep **Claims** and **Payments** as the two primary navigation workspaces, and expose a dedicated **Invoice history** view reachable through the Claims/billing context (a persistent, one-click entry point).

**RATIONALE:**

- The client's product direction is explicit: **two primary operational workspaces**, with invoices as an important object but not a third "unrelated application."
- Option **A** (purely contextual history) hides invoice history behind a flow step, failing requirement #13 (invoice history) as a first-class capability.
- Option **C** (three top-level nav items) gives invoices first-class discoverability but risks the "three unrelated applications" feeling the client explicitly wants to avoid.
- Option **B** honors both constraints: two primary workspaces, with invoices remaining a first-class **business object** (browseable, filterable history) accessible from a clear, persistent entry point rather than a buried flow step.

**SOURCE:** client-confirmed requirements #2, #13, #15.

**IMPACT ON IMPLEMENTATION:** Restore a persistent "Invoices/Billing" entry point (not necessarily a full third primary nav item — a first-class section reachable from Claims and from a global affordance). Provide a **flat, filterable invoice-history list** in addition to the org-first Accounts-Receivable ledger. Both views are useful and should coexist.

---

## 12. Financial traceability

### 12.1 Required navigations

| Navigation | Required? | Current state |
|---|---|---|
| Claim → Invoice | **Yes** | **Broken** for approved claims on draft/issued invoices (visible only via payment record after payout) |
| Invoice → Claims | **Yes** | Works (line items list claims) |
| Invoice → Organization payment | **Yes** | Works (invoice `paidAt`/`paidBy`/status) |
| Claim → Payment | **Yes** | Works once `to_be_paid`/`paid` |
| Payment → Claim | **Yes** | Works (payment record → claim) |
| Payment → Invoice | **Yes** | Works (payment record `invoiceId` → funding invoice) |

### 12.2 Decisions

**DECISION: All six navigations are mandatory.** The only current gap is **Claim → Invoice** for claims that are on a draft/issued invoice but not yet in the payout queue.

**DECISION: At each point, the visible information is:**

- **Claim → Invoice:** invoice number, status, date, and (if issued) amount. This must work from the moment the claim is on a draft.
- **Invoice → Claims:** full line items (claim number, clinic, amount, sessions, service date).
- **Invoice → Organization payment:** payment status, `paidAt`/`paidBy` (or "outstanding" if unpaid).
- **Claim → Payment / Payment → Claim:** payout record (payment reference, bank reference, paid date/by, amount).
- **Payment → Invoice:** the funding invoice (number, date, status).

**SOURCE:** architecture (line items, `PaymentRecord.invoiceId`, invoice payment fields); requirement #14.

**IMPACT ON IMPLEMENTATION:** The rebuild must thread a cross-linking component (the existing `FinancialRecordLink` is a candidate) through claim detail, invoice detail, and payment detail, and must fix the Claim → Invoice gap by exposing the invoice relationship on the claim endpoints (§5.3).

---

## 13. Organization payment → payout relationship

### 13.1 Confirm the transition

The following sequence is **confirmed correct** against the backend and is authoritative. **The claim state machine is not changed.**

```
Invoice issued                                  (invoice.status = issued)
  → org pays externally (off-platform)
  → Super Admin records organization payment    (invoice `issued → paid`, + paidAt/paidBy)
  → linked approved claims auto-queue            (claim `approved → to_be_paid`, + PaymentRecord with invoiceId)
  → Payments workspace (payout queue)
  → external clinic/employee payment executed
  → Super Admin records payout                   (claim `to_be_paid → paid`, + PaymentRecord finalized)
```

**SOURCE:** architecture (`markInvoicePaid`, `queueForPayment`, `processPayments`).

### 13.2 Two distinct financial operations

| | **Organization payment** | **Clinic/employee payout** |
|---|---|---|
| Direction | Money **IN** to Remedy (org → Remedy) | Money **OUT** of Remedy (Remedy → clinic/employee) |
| Trigger | Super Admin records org payment | Super Admin records payout |
| Effect on invoice | `issued → paid` | (none) |
| Effect on claim | `approved → to_be_paid` (queues each linked approved claim) | `to_be_paid → paid` |
| Ledger | Invoice document (`paidAt`, `paidBy`) | `PaymentRecord` (`paidAt`, `paidBy`, `paymentReference`, `bankReference`) |

**DECISION:** These are **different financial operations** and must never be conflated in the UI. Organization payment is recorded in the Invoices/billing context; clinic/employee payout is recorded in the Payments workspace.

---

## 14. Edge cases

Defined business behavior (to be implemented in the rebuild, not now):

| Edge case | Expected behavior |
|---|---|
| No eligible claims | Organization selector/claims table shows "no eligible claims"; Generate is disabled with a clear explanation. |
| No selected claims | Generate is disabled; the selection toolbar shows "0 selected." |
| Mixed organizations selected | Structurally prevented (§6.2); if it occurs via stale state, the UI forces a single-org scope and never merges orgs. |
| Already-invoiced claim selected | Disabled at selection time (backend also rejects at Generate). |
| Claim becomes invalid during invoice creation | Backend rejects the specific claim; UI reports exactly which claims were excluded and why (§7.2). |
| Duplicate invoice attempt | Backend guard excludes already-invoiced claims; UI prevents re-selecting them. |
| Invoice creation failure | Error surfaced; selection preserved so the admin can retry. |
| Invoice issue failure | Draft remains intact; error surfaced; retry allowed. |
| Draft abandoned | Archive the draft (`draft → archived`); claims remain `approved` and eligible to invoice again. |
| Organization has no claims | Organization selector shows the org with zero eligible claims; no invoice possible. |
| Invoice contains zero valid claims | Cannot occur — Generate is disabled with zero selection, and the backend rejects empty/ineligible input. |

---

## 15. Decisions

Consolidated decision register.

**D1 — Claim status vs invoice relationship**
- **DECISION:** "Invoiced" is a separate financial relationship, not a claim status.
- **RATIONALE:** Preserves the finalized `approved → to_be_paid → paid` machine; billing and payout have different lifecycles.
- **SOURCE:** finalized state machine (architecture).
- **IMPACT ON IMPLEMENTATION:** No new status; expose the relationship via a claim-side join (`invoiceId`/`invoiceNumber`) or a denormalized `invoiceId` field.

**D2 — Eligible claim rule**
- **DECISION:** `status == approved` AND not already referenced by any invoice line item.
- **RATIONALE:** Matches "approved → invoiceable → (org pays) → payout."
- **SOURCE:** client requirements; architecture (`generateInvoice` guard).
- **IMPACT ON IMPLEMENTATION:** Single rule enforced by backend, mirrored by frontend.

**D3 — Organization/invoice grouping**
- **DECISION:** One invoice = one organization; may span multiple clinics.
- **RATIONALE:** `InvoiceDocument.tenantId` is scalar; the confirmed workflow is org-first.
- **SOURCE:** architecture; confirmed workflow.
- **IMPACT ON IMPLEMENTATION:** Generation input is `{ organizationId, claimIds }`; selection is org-scoped.

**D4 — Claim selection is the billing source**
- **DECISION:** Explicit selection required; date range is a filter only; Select All = eligible claims in the current org/filter context; remove-before-create allowed; backend rejects ineligible selections with per-claim reporting.
- **RATIONALE:** Client requirements #6–#10.
- **SOURCE:** client-confirmed requirements.
- **IMPACT ON IMPLEMENTATION:** Selection is first-class client state; generation takes `claimIds`.

**D5 — Invoice creation lifecycle**
- **DECISION:** Generate → `draft`; Review → read-only confirmation; Issue → `draft → issued` (org billed). Draft editable (add/remove); draft abandonable (archive); issued immutable.
- **RATIONALE:** Matches the existing invoice transitions and the draft/review/issue intent.
- **SOURCE:** architecture; client requirements #7, #10, #12.
- **IMPACT ON IMPLEMENTATION:** Four actions (Generate/Review/Issue/Archive) + draft edit surface; a draft-edit endpoint must be added.

**D6 — Invoice date semantics**
- **DECISION:** `createdAt`/`serviceDate` are filters/metadata only; `issuedAt`/`generatedAt`/`period` are invoice metadata; nothing auto-selects claims by date.
- **RATIONALE:** Selection is explicit (D4); dates must not drive contents.
- **SOURCE:** client-confirmed requirements; architecture.
- **IMPACT ON IMPLEMENTATION:** Remove service-date from the eligibility path; keep it as display metadata.

**D7 — Invoice contents**
- **DECISION:** Org, invoice number, invoice date, billing period, line items (claim ref, clinic, amount, sessions, service date), total. Employee identity and bank details are Super-Admin-UI-only.
- **RATIONALE:** Employee identity excluded per the existing anonymity layer.
- **SOURCE:** architecture (line-item schema; tenant-admin anonymity).
- **IMPACT ON IMPLEMENTATION:** No line-item schema change; Super Admin detail joins employee identity at display time if needed.

**D8 — Invoice history / navigation**
- **DECISION:** Option B — two primary workspaces (Claims, Payments) + a dedicated invoice-history view via a persistent entry point.
- **RATIONALE:** Honors "two primary workspaces" and "invoice history" without a third top-level app.
- **SOURCE:** client requirements #2, #13, #15.
- **IMPACT ON IMPLEMENTATION:** Persistent "Invoices/Billing" entry point + a flat, filterable invoice-history list alongside the org-first ledger.

**D9 — Financial traceability**
- **DECISION:** All six navigations mandatory; fix Claim → Invoice for pre-payout claims.
- **RATIONALE:** Requirement #14.
- **SOURCE:** client-confirmed requirements; architecture.
- **IMPACT ON IMPLEMENTATION:** Expose invoice relationship on claim endpoints; thread cross-links through detail views.

**D10 — Organization payment → payout**
- **DECISION:** Confirmed sequence; organization payment (`issued → paid`) and clinic/employee payout (`to_be_paid → paid`) are distinct operations.
- **RATIONALE:** Matches backend `markInvoicePaid`/`queueForPayment`/`processPayments`.
- **SOURCE:** architecture.
- **IMPACT ON IMPLEMENTATION:** No state-machine change; UI keeps the two recording actions in separate contexts.

**D11 — Bulk operations**
- **DECISION:** Allow Select All, bulk draft creation, org-scoped selection, selection count/total, review-before-issue, duplicate protection. No mixed-org. No bulk payment transfers.
- **RATIONALE:** Client requirement #8 ("bulk billing preparation, not bulk banking").
- **SOURCE:** client-confirmed requirements.
- **IMPACT ON IMPLEMENTATION:** Persistent selection toolbar; bulk billing only.

**D12 — After invoice creation**
- **DECISION:** Generate Draft → **automatically open the draft/review** so the admin immediately sees the selected claims and next actions.
- **RATIONALE:** The admin must always understand what happened to the selected claims (explicit client intent).
- **SOURCE:** client requirement #15; product direction.
- **IMPACT ON IMPLEMENTATION:** Post-generate navigation opens the draft detail/review.

**D13 — Edge cases**
- **DECISION:** Behaviors as tabulated in §14.
- **RATIONALE:** Fills the gaps the sources leave implicit.
- **SOURCE:** derived from confirmed workflow + architecture.
- **IMPACT ON IMPLEMENTATION:** Empty/error/invalid-selection states must be designed, not defaulted.

**D14 — Remove/retain existing date-based generation**
- **DECISION:** **MODIFY** — remove the date-window auto-scoop; repurpose date range as a filter only; change the generation input to explicit `claimIds`.
- **RATIONALE:** Date-based generation directly contradicts the selection-based model; the underlying draft-creation primitive is retained.
- **SOURCE:** client requirements #6–#10; architecture (`generateInvoice` current behavior).
- **IMPACT ON IMPLEMENTATION:** Change `generateInvoice` input from `{ tenantId, from, to }` to `{ tenantId, claimIds }`; keep the double-invoicing guard; delete/retire the `generated` dead state.

---

## 16. Unresolved questions

Only questions that genuinely cannot be answered from the existing material:

1. **Draft editing scope** (`CLIENT_CLARIFICATION_MASTER.md` Q18/Q30-related): Is adding claims to a draft (post-generation) desired, or is editing limited to removing claims from the selection before generation? The client explicitly confirmed *removal*; *adding during review* is not explicitly confirmed.
2. **`serviceDate` semantics** (`Q69`): Is it the service-rendered date or the invoice date? Does not block billing (not a driver) but affects a label and whether it should be required.
3. **Invoice cadence** (`Q30a`): monthly / quarterly / per-claim, and whether an organization may have multiple open invoices or should consolidate to one per period. The confirmed model implies per-selection invoices, but the consolidation cadence is not locked.
4. **`in_progress` vs `pending`** (Q17–Q18): The exact Super-Admin-facing meaning and whether the admin needs to distinguish them in the Claims table beyond "not eligible."
5. **Employee identity on invoice** (`Q36` anonymity): Confirmed *off* the org-facing invoice per the anonymity layer, but not explicitly re-confirmed by the client for invoices specifically — worth one confirmation pass.
6. **Whether "invoiced" needs a claim-side field** (§5.3): join-at-read vs denormalized `invoiceId` — an implementation choice, not a business ambiguity, but it should be settled before the rebuild.

---

## 17. Implementation implications

What the future React/Next.js rebuild must support (not implemented now):

1. **Claim-side invoice relationship:** the admin claim list/detail endpoints must expose `invoiceId`/`invoiceNumber` (or `invoiced: boolean`) so eligibility and traceability are computable without client-side invoice scans.
2. **Selection-based generation:** backend `generateInvoice` must accept explicit `claimIds`; date range becomes a list filter only.
3. **Draft edit endpoint:** to support add/remove claims on a draft (if confirmed — see §16.1), a draft-edit operation must exist alongside generate/issue/pay/archive.
4. **Retire the `generated` dead state** or implement it deliberately; remove it from any UI filters.
5. **Persistent, org-scoped selection state** in the Claims page, distinct from display filters, with a selection toolbar (count, total, Select All, remove).
6. **Post-generate navigation** to the draft/review surface.
7. **Cross-linking** (Claim ↔ Invoice ↔ Payment) threaded through detail views.
8. **Confirmation gates** on irreversible transitions (Issue, Mark Paid, Record Payout, Archive).
9. **Org-first grouping** preserved; invoice generation remains single-org with multi-clinic line items.
10. **Flat invoice-history list** alongside the org-first A/R ledger.
11. **Status legend / glossary** so the admin can read `approved`, `to_be_paid`, and the invoice relationship plainly.

The claim state machine, permissions, authentication, and payment processing are **not** part of the rebuild's changes.

---

# Future Super Admin SaaS Redesign

*This is NOT part of this implementation phase. It is deferred until the financial workflows and React architecture are stable, to avoid redesigning the same screens twice.*

**Requirement:** After the business workflows and React architecture are stabilized, the Super Admin dashboard should receive a **comprehensive SaaS-quality redesign**.

**Objective:** A professional SaaS Super Admin operations dashboard that makes the **next action obvious** while preserving Super Admin power — not merely "make it prettier."

The redesign should eventually address:

- **Global navigation** — a coherent, predictable top-level structure (built around the two primary workspaces + accessible invoice history).
- **Dashboard overview** — a decision-oriented landing surface.
- **Visual hierarchy** — one clear primary action per screen.
- **Information density** — reduce the eight-card status sprawl to decision-relevant summaries.
- **Summary cards** — decision cards (eligible-to-invoice, in-progress, awaiting-payout, paid-this-period) over exhaustive status counts.
- **Operational alerts** — surface blocking exceptions (missing bank details, zero-line-item drafts) prominently.
- **Tables** — priority-ordered columns, clear status, inline invoice-relationship indicators.
- **Filters** — a unified, persistent filter surface (org, status, search covering clinic/org name, date).
- **Responsive layouts** — mobile-first breakpoints, no horizontal scroll.
- **Loading/skeleton states** — skeleton screens for async financial data rather than blocking spinners.
- **Empty states** — helpful, actionable empty states ("no eligible claims", "no invoices yet").
- **Error states** — clear error + recovery path (retry/edit) for failed generation/issue/payout.
- **Action hierarchy** — one primary CTA, subordinate secondary actions, confirmation on irreversible financial transitions.
- **Typography** — a consistent type scale (16px body, tabular figures for amounts).
- **Spacing** — a 4/8pt incremental spacing system.
- **Status visualization** — consistent status badges with icon + text (not color alone).
- **Consistent design tokens** — semantic tokens (surface, primary, success, danger) over raw hex.
- **Cross-page consistency** — one shared financial component vocabulary.

**Do NOT implement the redesign now.** It is intentionally postponed until the financial workflows and React architecture are stable.
