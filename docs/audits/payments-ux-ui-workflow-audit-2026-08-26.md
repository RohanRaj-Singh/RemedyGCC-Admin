# Payments UX/UI + Workflow Audit

**Date:** 2026-08-26
**Phase:** 4A — Super Admin Payments, AUDIT ONLY (no implementation).
**Method:** Traced the actual code across both projects — `remedygcc-admin` (Super Admin UI + proxy) and `tenantapp` (payment service, state machine, data model). No behavior inferred without reading the source.

---

## 1. Scope

Super Admin **Payments** workspace only. Claims and Invoices are out of scope and
must not be modified (Phase 3 is the current baseline).

Two distinct financial operations must be kept separate throughout this audit:

- **Organization pays Remedy** (invoice `issued → paid`) — cash *in* to Remedy.
- **Super Admin pays the clinic/employee** (claim `to_be_paid → paid`) — cash *out*.

And three distinct *stages* of the payout operation:

- **Preparation** — gathering the bank details/amounts needed to make the transfer.
- **Execution** — the external bank transfer itself (NOT performed by this system).
- **Recording** — writing the ledger record that the transfer happened.

The application **records** financial actions; it does **not** execute bank
transfers. This is confirmed in code (`PaymentRecordDialog.tsx` header comment and
`paymentService.ts`).

---

## 2. Client Requirements

From the project's established material (carried from prior phases and the verified
Claims → Invoice workflow):

1. Super Admin experience must be **simple and guided** — answer "What do I need to
   do here?" in seconds without training.
2. The operator must be able to see **who** to pay, **how much**, **which
   clinic/organization**, **which bank**, **which claim/invoice funds it**, **what is
   already paid**, **what is blocked and why**, and **what to do next**.
3. Bulk operations are explicitly wanted — but "bulk" means operating on multiple
   claims in one review, not auto-sending money to the bank.
4. Payouts happen **externally**; the Super Admin then **records** them.
5. Bank details are a known business concern (see §6).

These are consistent with the frozen state machine; nothing here contradicts it.

---

## 3. Current Payments Architecture

### Files

| Layer | File | Role |
|---|---|---|
| UI — workspace | `remedygcc-admin/src/app/payments/page.tsx` | Org→Clinic→Claim payout workspace (753 lines) |
| UI — detail | `remedygcc-admin/src/app/payments/[claimId]/page.tsx` | Single payment detail + printable PDF |
| UI — layout | `remedygcc-admin/src/app/payments/layout.tsx` | Sidebar wrapper |
| Component | `src/components/financial/PaymentRecordDialog.tsx` | Confirm-before-record modal |
| Component | `src/components/financial/PrintablePayment.tsx` | Printable payment-advice template |
| Proxy (used) | `src/app/api/super-admin/payments/operations/route.ts` | → tenant `/api/admin/payments/operations` |
| Proxy (used) | `src/app/api/super-admin/payments/process/route.ts` | → tenant `/api/admin/payments/process` |
| Proxy (used) | `src/app/api/super-admin/payments/[claimId]/route.ts` | → tenant `/api/admin/payments/:claimId` |
| Proxy (unused) | `src/app/api/super-admin/payments/route.ts` | → tenant `/api/admin/payments` (list queue) |
| Proxy (unused) | `src/app/api/super-admin/reimbursements/[id]/pay/route.ts` | → tenant `/api/reimbursements/:id/pay` |
| Proxy (unused) | `src/app/api/super-admin/reimbursements/[id]/queue-payment/route.ts` | → tenant `/api/reimbursements/:id/queue-payment` |
| Service | `tenantapp/src/server/services/paymentService.ts` | queue/process/detail/list/operations |
| Service | `tenantapp/src/server/services/reimbursementService.ts` | raw state machine (`queueForPayment`, `payReimbursement`) |
| Service | `tenantapp/src/server/services/invoiceService.ts` | `markInvoicePaid` auto-queues claims |
| Repo | `tenantapp/src/server/repositories/paymentRecordsRepository.ts` | ledger + unique `claimId` index |
| Model | `tenantapp/src/server/db/documents.ts` | `PaymentRecordDocument`, `ReimbursementDocument`, `InvoiceLineItem`, `EmployeeDocument` |

### Data model (relevant fields)

- **Claim** (`ReimbursementDocument`) carries `bankAccountNumber` / `bankName` — the
  payout snapshot — plus `clinicId`/`clinicName`, `employeeId`/`employeeName`, `amount`.
- **PaymentRecord** (`PaymentRecordDocument`): `claimId` (unique), `tenantId`,
  `invoiceId?`, `clinicId?`/`clinicName?`, `amount`, `status` (`to_be_paid` | `paid`),
  `paymentReference?`, `bankReference?`, `notes?`, `paidAt?`, `paidBy?`, `method?`.
  **No bank snapshot field.**
- **InvoiceLineItem** carries `bankAccountNumber`/`bankName` (claim snapshot copied at
  invoice generation) for traceability.
- **Employee** (`EmployeeDocument`) carries `bankAccountNumber`/`bankName` (legacy).
- **Admin clinic directory** (`src/modules/clinic/types.ts`, `src/server/clinic/repository.ts`)
  carries `bankName`/`bankAccountNumber` with the comment *"Payout details — used by
  the super-admin payment queue"* — but the tenant-app payout path **never reads
  clinic bank**. (See §6 and §21.)

---

## 4. Actual Data Flow

```
Employee / Tenant Admin creates claim (bankAccountNumber/bankName snapshot optional)
        ↓
Tenant Admin approves claim (approved)
        ↓
Super Admin selects approved claims → generate invoice (draft)
        ↓
Super Admin issues invoice (issued)
        ↓
Organization pays Remedy EXTERNALLY
        ↓
Super Admin marks invoice paid (issued → paid)          [invoiceService.markInvoicePaid]
        ↓   for each line-item claim still "approved":
        ↓     queueForPayment → claim approved → to_be_paid
        ↓     PaymentRecord created { status:"to_be_paid", invoiceId }
        ↓
Payments workspace reads all to_be_paid claims           [listPaymentOperations]
        ↓   resolves effective bank: claim snapshot, else employee fallback
        ↓
Super Admin reviews + records payout EXTERNALLY already happened
        ↓
processPayments(claimIds)                                [paymentService.processPayments]
        ↓   per claim: payReimbursement → claim to_be_paid → paid
        ↓   PaymentRecord finalized { status:"paid", paymentReference, bankReference?, paidAt, paidBy }
        ↓
Payment detail / PrintablePayment PDF (window.print)
```

Key facts confirmed by reading the code:

- **Where ready-to-pay claims come from:** `reimbursements.findAll({ status: "to_be_paid" })` — the queue is defined purely by claim status.
- **How they are filtered:** client-side (search + org) on the full workspace payload; server supports only an optional `tenantId`.
- **How bank details resolve:** claim snapshot first; employee profile fallback for legacy claims; `bankSource` tags the result (`claim` / `employee_fallback` / `missing`).
- **What makes a claim payout-ready:** `status === "to_be_paid"` (backend) AND bank complete (UI only — see §5).
- **How payment records are created:** on queue (`queueForPayment`) and finalized on pay (`processPayments`).
- **How duplicate payments are prevented:** `assertValidTransition` (paid is terminal) + unique `claimId` index on `paymentRecords`.
- **How a claim becomes paid:** `payReimbursement` (`to_be_paid → paid`).
- **How relationships resolve:** `PaymentRecord.claimId` → claim; `PaymentRecord.invoiceId` → invoice; claim/invoice/payment all joined at read time.

---

## 5. Payout Readiness Rule

### The exact rule found in code

**Backend queue membership (the only thing the backend defines as "ready"):**

```
READY (backend) = claim.status === "to_be_paid"
```

A claim reaches `to_be_paid` only via `queueForPayment`, which enforces
`approved → to_be_paid`. Two call paths lead there:

1. `markInvoicePaid` (the normal path) — for each line-item claim still `approved`.
2. `reimbursements/[id]/queue-payment` (single, direct) — no invoice required.

**UI "ready to record" gate (client-only, NOT a backend invariant):**

```
claimBankReady(claim) = effectiveBankAccountNumber && effectiveBankName (both non-empty)
```

Effective bank = claim snapshot (`bankSource === "claim"`), else employee profile
(`bankSource === "employee_fallback"`), else `missing`.

### Critical finding

`processPayments` **does not validate bank details**. It will mark any `to_be_paid`
claim paid. The "ready to pay" requirement (valid bank) is enforced **only** by the
UI (the record dialog only opens for `claimBankReady` claims, and the per-claim
record button only renders when bank-ready). The backend has no guard.

In practice the admin UI never submits non-ready claims, so the invariant holds
today — but it is a UI convention, not a system guarantee. The `process` endpoint
also accepts an empty `claimIds` ("process every `to_be_paid` claim"), which would
pay *blocked* (bank-missing) claims if ever invoked that way. The admin UI never
does; the API contract alone is unsafe.

### Rule vs UI communication

The UI communicates the *effective* rule correctly (ready = bank complete), but the
boundary is implicit: a "Blocked" claim is still in the same `to_be_paid` queue as a
"Ready" claim — the distinction exists only as a client-side color/badge, not a
persisted state or backend distinction. The operator cannot tell from the backend
what is "blocked"; they can only tell from the UI's derived badge.

---

## 6. Bank Details Architecture

### Where bank details are stored (three places)

| Source | Field | Used for payout? |
|---|---|---|
| **Claim snapshot** (`ReimbursementDocument.bankAccountNumber/bankName`) | set at claim creation (employee or tenant admin) | **Yes — source of truth** |
| **Employee profile** (`EmployeeDocument.bankAccountNumber/bankName`) | set at signup/profile | **Legacy fallback only** (when claim has none) |
| **Admin clinic directory** (`Clinic.bankName/bankAccountNumber`) | set in the clinic directory | **No — never read by payout path** |

### Which bank becomes the payout snapshot

The **claim snapshot** is authoritative. It is copied onto the `InvoiceLineItem`
("claim's immutable bank snapshot carried through for payout traceability") at
invoice generation. The Payments workspace resolves it server-side:

- claim has bank → `bankSource: "claim"`.
- claim lacks bank, employee has bank → `bankSource: "employee_fallback"` (legacy
  compatibility; new claims are expected to carry their own).
- neither → `bankSource: "missing"` → claim shown "Blocked".

### Whether the claim stores a bank snapshot

Yes — `bankAccountNumber` / `bankName` live on the claim itself.

### Whether the PaymentRecord snapshots bank

**No.** The PaymentRecord stores no bank fields. Bank info on the printable payment
advice is re-read **live from the claim** at detail/print time. Because paid claims
are read-only (`updateReimbursement` blocks `paid`), the bank snapshot is
*effectively* frozen at payout — but it is an **implicit** freeze (claim
immutability), not an **explicit** snapshot on the ledger. If a claim were edited
between queueing and payout (which the state machine permits — only `paid` is
read-only), the recorded payout could reflect a different bank than what was shown
at queue time. This is a real, if narrow, financial-integrity gap.

### What happens when bank details are missing

The claim remains in the queue (`to_be_paid`) and is surfaced as "Blocked" with the
micro-label "no bank" / "missing bank details". The Super Admin can see *that* it is
blocked and *why* (missing bank), but there is **no inline resolution path** — the
operator must leave Payments and edit the employee or clinic record elsewhere. The
system does not offer "capture bank details here."

### Whether bank info can change after claim creation

Yes — via `updateReimbursement` (tenant admin or employee edit) until the claim is
`paid`. There is no audit trail on bank changes (no bank history).

### Discrepancy

The admin clinic directory still stores `bankName`/`bankAccountNumber` labelled
"used by the super-admin payment queue", but the payout queue reads only
claim → employee. This is **drift** — either the clinic bank fields are legacy and
should be retired, or they were intended as a third fallback/override that was never
wired. Flagged as a conflicting bank source (§21).

---

## 7. Payment Recording Workflow

`processPayments({ claimIds?, bankReference?, notes?, actorId })`:

1. Resolve targets: supplied `claimIds` filtered to those currently `to_be_paid`; or,
   if no `claimIds`, **all** `to_be_paid` claims.
2. For each target: `payReimbursement` (`to_be_paid → paid`, history entry, notify).
3. Finalize the PaymentRecord: `status: "paid"`, `paymentReference` (generated
   `PAY-YYYY-NNNNNN`), `bankReference?`, `notes?`, `paidAt`, `paidBy: actorId`.
4. Returns `{ processed }`.

**What "Record Payment" actually does:** it changes claim status to `paid` AND
finalizes the ledger record. It does **not** move money.

**Fields recorded:** paymentReference (auto), bankReference (optional, operator-supplied),
notes (supported by backend but **not exposed** in the admin dialog), paidAt, paidBy.

**Fields NOT recorded (re-read from claim later):** bank account/name, employee name,
recipient identity, service details. The ledger is a thin pointer to the claim.

**Is invoiceId recorded?** Yes — set on the PaymentRecord at queue time by
`markInvoicePaid`.

**Is claimId recorded?** Yes (`claimId`, unique).

**Is employee/clinic recorded?** Clinic yes (`clinicId`/`clinicName`); employee **no**
(derived from claim join). 

**Is who recorded the payment stored?** Yes — `paidBy` = `"super-admin"` (a constant
string, not a user identity).

### Two divergent "mark paid" paths (important)

- `processPayments` → updates claim to `paid` **and** finalizes the PaymentRecord.
- `reimbursements/[id]/pay` → `payReimbursement` marks claim `paid` **without any
  PaymentRecord write**.

If the single `/pay` route were used, a claim could be `paid` while its PaymentRecord
is still `to_be_paid` (or absent). The current admin UI uses only `processPayments`,
so this latent inconsistency is not triggered today — but both endpoints exist,
are authorized, and have different ledger behavior.

---

## 8. Individual Payment Workflow

Per-claim "Record" button (rendered only when `claimBankReady(claim)` is true):

1. Opens `PaymentRecordDialog` with exactly one claim.
2. Dialog shows: claim number, employee, clinic, service date, amount, bank, funding
   invoice, and a "what this action does" explainer.
3. Operator optionally enters a bank/transfer reference.
4. Confirm → `POST /payments/process { claimIds: [one] }`.
5. Success banner; claim leaves the queue; appears in history.

This is clean and correctly scoped. The single-claim path reuses the same
`processPayments` service (consistent ledger behavior) — good.

---

## 9. Bulk Payment Workflow

Current "bulk" model (from the page's `openBulkRecordDialog`):

- The top "Record N Payments" button collects **every** bank-ready claim across the
  visible organizations into one dialog.
- The dialog groups them into payout cohorts (`invoiceId :: bankAccount :: clinic`)
  for review, showing bank + funded-by invoice + per-claim rows.
- A single confirm marks all of them paid in one `processPayments` call.

What "bulk" does **not** do today:

- No **subset selection** — "bulk" is "all ready", not "choose these N".
- No **payment batch** entity, no batch preparation, no downloadable batch of bank
  details for the external transfer.
- No **staged execution** (prepare → execute → record) as separate steps.

The service comment states this explicitly: *"Payment batches are intentionally NOT
part of Version 1."* The data model keeps no batch extension point beyond the
`notes`/`bankReference` fields.

**Recommendation (not implemented):** bulk should mean "select multiple claims →
prepare payment info (downloadable bank/amount list) → record completed transfers",
with the three stages kept explicit. The current single-confirm "mark all paid" is
dangerous for large queues because it does not let the operator review a bounded,
chosen subset first.

---

## 10. Payment Table Audit

The queue is **not a table** — it is a 3-level drill-down tree (Org → Clinic → Claim).
The history view is a flat table.

**Queue (tree) columns/fields:**

| Field | Verdict |
|---|---|
| Organization name + outstanding + "ready today" + blocked + overdue | KEEP (org summary) |
| Clinic name + count + total + ready/blocked + "bank (claim)" + fallback flag | KEEP (clinic summary) — but "bank (claim)" shows only the first claim's bank name, potentially misleading |
| Claim number (link) | KEEP |
| Employee name | KEEP |
| Bank status micro-label (`bank ok` / `no bank` / `profile fallback`) | COMBINE → a proper "blocked reason" badge |
| Invoice number (link) | KEEP |
| Amount | KEEP |
| Per-claim "Record" button | KEEP (primary action) |

**History table columns:** Payment Ref, Bank Ref, Claim #, Invoice, Tenant, Clinic,
Amount, Paid Date, Paid By.

| Field | Verdict |
|---|---|
| Payment Ref (link to detail) | KEEP |
| Bank Ref | KEEP |
| Claim # | KEEP |
| Invoice (link) | KEEP |
| Tenant | KEEP (context) |
| Clinic | KEEP |
| Amount | KEEP |
| Paid Date | KEEP |
| Paid By | KEEP (constant "super-admin" — low value; could MOVE TO DETAIL) |

Missing from history: **bank destination** (who was actually paid), **payment method**
(unused field), and any **sort** control (history is server-sorted by paidAt desc
only).

---

## 11. Payment History Audit

The history view is a "lightweight reconciliation trail" — a flat table of paid
PaymentRecords with payment/bank references, claim/invoice links, tenant/clinic,
amount, date, and paid-by. It answers "what was paid, who, how much, when, related
claim/invoice, reference" adequately.

Weaknesses:

- No search/filter within history (only the org filter on the workspace affects it).
- No aggregation ("total paid this period") beyond the single "Paid Today" KPI.
- "Paid By" is always the literal string `super-admin`, so it conveys no information.
- Export is client-side CSV of the loaded history (no server-side export endpoint).
- Paid records live behind a toggle ("Payment History") rather than a first-class tab;
  no per-org history breakdown.

**Verdict:** useful but raw; it answers reconciliation minimally. Recommend keeping
paid history in the same workspace as a first-class tab (not a toggle) and adding a
per-org + period rollup.

---

## 12. Blocked Payment UX

Blocked = bank-missing claim still in the `to_be_paid` queue.

Current exposure:

- KPI "Blocked" (count + amount).
- Clinic-level amber dot + "N need bank info".
- Claim-level micro-label "no bank" / "profile fallback".
- Empty-ready banner: "N claims are blocked — missing bank info on file. Resolve
  missing bank details before these can be paid."

What is **not** exposed:

- **Why** specifically (which bank field — account vs name — is missing).
- **What to do next** (there is no in-place resolution; the operator must know to go
  to the employee or claim detail).
- Whether "blocked" is a temporary state (awaiting data) or a hard blocker.

This is exactly the "Missing details" anti-pattern the client wants avoided. The
system *knows* the bank is missing (server computes `bankSource: "missing"`) but only
surfaces a generic label, not an actionable reason + path.

---

## 13. Invoice ↔ Payment Traceability

| Direction | Present? | How |
|---|---|---|
| Payment → Invoice | ✅ | `PaymentRecord.invoiceId`/`invoiceNumber`; dialog "Funded by"; history invoice link; detail shows invoice number |
| Invoice → Payout status | ⚠️ indirect | Invoice detail links line items to claims, and the claim detail shows payment status — but there is **no** payout status directly on the invoice line item |
| Invoice → Payment link | ❌ | Invoice detail does not link to the payment record, only to the claim |

The chain Invoice → Claim → Payment is navigable but two hops. The operator cannot,
from an invoice, see "this line item was paid out on DATE with reference X" in one
glance.

---

## 14. Claim ↔ Payment Traceability

| Direction | Present? | How |
|---|---|---|
| Claim → Payment | ✅ | Claim detail fetches `/payments/:claimId`, renders a payment reference + link; `PrintableClaimReceipt` links to the payment |
| Payment → Claim | ✅ | PaymentRecord `claimId`; detail shows full claim snapshot; history links claim # |
| Payment → Recipient identity | ⚠️ | Employee name re-read from the **live** claim, not snapshotted on the PaymentRecord |
| Payment → Bank destination | ⚠️ | Re-read from the claim, not snapshotted on the PaymentRecord |

A payment record reliably identifies claim, invoice, organization, clinic, amount,
reference, and date. It does **not** independently store the recipient/bank that was
actually paid — those are always derived from the (mutable-until-paid) claim.

---

## 15. Loading / Empty / Error / Success UX

**Loading**
- Workspace: good — a `PaymentsSkeleton` mirrors KPI + filter + org blocks (no
  layout shift).
- Detail page: **bad** — a full-page centered `Loader2` spinner, contradicting the
  Phase 3 standard of "no full-page spinners".

**Empty states**
- No queue: a sky-tinted informational banner + a neutral empty card. Adequate but
  generic; does not clearly separate "no org selected" vs "no claims queued".
- No history: neutral empty with "Recorded payouts will appear here." Fine.
- No search results: no dedicated empty state — the org list simply renders empty.

**Error**
- Workspace load error: `FinancialExceptionBanner`. Good.
- Record error: surfaced inline in the dialog. Good.

**Success**
- Record success: `SuccessBanner` "…recorded as paid. Payment ledger updated."
  with a link **"Back to Invoices"** — an odd destination; a payout success should
  point to "Payment History" or back to the queue, not Invoices.

---

## 16. React / Next.js Architecture Problems

1. **Giant page component** — `payments/page.tsx` is 753 lines with business logic
   (aggregation, readiness, filtering) inline in `useMemo`/JSX.
2. **Duplicated formatting** — `formatCurrency`/`formatDate` are re-defined locally
   instead of using the shared `@/lib/financial/format` (Phase 3 extraction).
3. **Duplicated readiness logic** — `claimBankReady` is called repeatedly across
   multiple `useMemo` passes and in JSX (org metrics, readyClaims, clinic rows,
   claim rows); no single derived model.
4. **Multiple O(n) passes** — `orgMetrics`, `kpis`, `visibleOrgs`, `readyClaims` each
   walk the nested org→clinic→claim structure.
5. **Client-side filtering of the full dataset** — search is applied in `visibleOrgs`
   after the entire workspace is loaded; no server-side search/sort.
6. **Business logic in JSX** — clinic ready-count/amount and "effective bank" are
   computed inline during render.
7. **`method` and `notes`** — `PaymentRecordDocument.method` is never set; `notes` is
   supported by the backend but not surfaced in the dialog.

---

## 17. Performance Findings

1. **Server `listPaymentOperations` is heavy** — it loads the entire `to_be_paid`
   queue (`limit: 100_000`), then makes per-invoice and per-employee lookups, then
   performs `queue.reimbursements.find(...)` **inside nested loops** (O(n²) by claim
   count) to attach employee/bank fallback.
2. **Multiple full table scans** — `listByStatus("to_be_paid")`, `listByStatus("paid")`,
   and the queue `findAll` each scan `paymentRecords`/`reimbursements`.
3. **No pagination** on the workspace — every claim is always returned and rendered.
4. **Detail page** re-fetches the claim + payment on every navigation; no caching.
5. **Client** recomputes aggregation over the whole dataset on every filter/search
   keystroke (search is un-debounced client-side).

No caching or broad optimization is done here (per audit-only), only causes are listed.

---

## 18. Visual/UI Problems

1. **Three-level drill-down is heavy** — reaching an individual claim requires opening
   Org then Clinic. The "what do I do now" answer (top "Record N Payments") is good,
   but individual review is buried three levels deep.
2. **Nested scroll/tap targets** — clinic and claim rows are `cursor-pointer` nested
   inside org `cursor-pointer` rows; clicking a claim link vs. expanding a row is
   ambiguous (the "Record" button uses `stopPropagation`, but the claim link does not).
3. **"Ready today" is stated four times** — KPI card, org "Ready Today" metric,
   next-action banner, and the `#pay-ready` banner all repeat the same number.
4. **Purple "Paid Today" tone** — `FinancialSummaryCards` supports a `purple` tone
   used only here; purple is also used for "Awaiting payout" on claim detail. Purple
   reads as an AI-generic accent, not a semantic finance tone (see the earlier
   `ai-color-palette` note on claim detail).
5. **Fallback bank is easy to miss** — "legacy fallback" is a small inline label; the
   operator is not clearly warned they are paying an employee-profile bank, not a
   claim-captured bank.
6. **Detail page** has a full-page spinner and a raw "Payment not found" red box
   (no shared empty/error component).

---

## 19. Patched / Redundant UI

1. **Three dead proxy routes** — `payments/route.ts` (list queue),
   `reimbursements/[id]/pay/route.ts`, `reimbursements/[id]/queue-payment/route.ts`
   are not referenced by any current UI. Two of them proxy to tenant endpoints with
   **divergent ledger behavior** (§7).
2. **Duplicated "ready" surfacing** — four surfaces repeat the ready count/amount.
3. **`notes` field** — backend supports it; dialog does not expose it.
4. **`method` field** — dead on the document.
5. **Misleading dialog comment** — `PaymentRecordDialog` claims it "excludes
   already-paid claims and surfaces a warning block", but the code performs **no**
   already-paid filtering (the queue is already `to_be_paid`-only, so the claim is
   technically satisfied upstream, but the dialog itself does not implement what its
   comment describes).
6. **"Back to Invoices" success link** — points away from the payments context.
7. **Admin clinic bank fields** — labelled "used by the payment queue" but unused (§6).

---

## 20. Missing Capabilities

1. **Payment batch preparation/export** — no way to download a list of bank details +
   amounts for the external transfer (the client's actual need).
2. **Server-side search/sort/filter/pagination** on payments.
3. **Inline bank resolution** — no way to fix a "blocked" claim from Payments.
4. **Bank snapshot on the ledger** — the payment record does not freeze the bank that
   was actually used.
5. **Undo** for a recorded payout.
6. **Per-org/per-period payment rollups** beyond "Paid Today".
7. **`notes` capture** in the record dialog.
8. **Blocked-reason specificity** (which bank field is missing, and the resolution
   path).

---

## 21. Conflicting / Unclear Business Rules

1. **"Ready to pay" = valid bank is UI-only.** Backend `processPayments` pays any
   `to_be_paid` claim regardless of bank. *Is bank-completeness a hard business rule
   or a soft UI hint?* — unresolved.
2. **Three bank sources (claim / employee / clinic).** Claim is current source of
   truth, but the clinic directory still advertises "payout details". *Which wins,
   and is the clinic source legacy?* — unresolved.
3. **"Overdue > 14 days"** is a hard-coded `OVERDUE_DAYS = 14` with no client-specified
   SLA evidence. *Is 14 days the agreed payout SLA?* — unresolved.
4. **Single `/pay` vs `processPayments`** — two mark-paid paths with different ledger
   behavior. *Should the single path be deprecated or made ledger-consistent?* —
   unresolved (recommend deprecate).
5. **Two queue paths** — `markInvoicePaid` (normal, writes PaymentRecord + invoiceId)
   vs `queue-payment` (direct, **does not** write PaymentRecord). *Is direct
   queue-without-invoice a supported operation?* — unresolved.
6. **"Paid Today"** window — *is "today" the correct reporting window, or
   "this week/month"?* — unresolved.

---

## 22. Recommended Payments Information Architecture

Organize the workspace around the operator's three questions, not the data model:

1. **Ready for payout** — bank-complete `to_be_paid` claims, primary surface.
2. **Blocked** — bank-missing claims, each with a specific reason + resolution path.
3. **Paid** — reconciliation history (reference, bank, date, claim, invoice).

Keep the three stages of the *payout operation* explicit and in order:

```
READY → review → prepare (downloadable bank/amount list) → external transfer → record
BLOCKED → see why → resolve / wait
PAID → history / traceability
```

Primary navigation should be **Ready / Blocked / Paid** (three states), with org and
clinic as grouping/filter dimensions *within* "Ready", rather than the current
Org-first drill-down that buries the actionable states.

---

## 23. Recommended Payments Rebuild

Target a flat, filterable **claim-level** table (one row = one payout) as the primary
view, grouped by clinic/org via sortable columns rather than a nested tree — the tree
hides the actionable unit. Specifically:

- **Ready** tab: claim rows with employee, clinic, org, amount, bank (masked),
  funding invoice, and a checkbox for batch selection. A single primary CTA
  "Prepare payout" produces a review sheet (bank + amounts) before recording.
- **Blocked** tab: same rows filtered to bank-missing, each with a "why + fix" cell.
- **Paid** tab: the history table, with per-org/period rollup and claim/invoice links.

Keep the shared financial primitives (`formatCurrency`, `FinancialRecordLink`,
`ConfirmActionDialog`, skeleton/empty/error components) and the derived-status
discipline from Phase 3, but do **not** force Payments into the Claims layout.

---

## 24. Required Components for Future Rebuild

- `PayoutReadiness` pure-logic module (mirror the server's `bankSource` resolution).
- `PaymentTable` / `PaymentRow` with selection, masked bank, blocked-reason cell.
- `PayoutBatchReview` — the preparation step (group by bank/cohort, downloadable).
- `PaymentConfirmDialog` — replace/extend `PaymentRecordDialog` to expose bank
  source, notes, and a real already-paid guard.
- `BlockedReasonBadge` — specific reason + resolution link.
- Reusable `PaymentSkeleton` / `PaymentEmptyState` / `PaymentError` (shared, not
  page-local).
- `PrintablePayment` reuse for the per-payout advice PDF; add a batch export (CSV).

---

## 25. User Journeys

**Journey A — pay a single clinic (happy path):**
Open Payments → see "Ready" count → open Ready → find the claim → Record → confirm
context (employee, clinic, bank, invoice) → add bank reference → Mark Paid → success
("view in history").

**Journey B — pay everything ready (bulk, today's behavior):**
Open Payments → "Record N Payments" → review grouped cohorts → confirm → all marked
paid → success.

**Journey C — investigate a blocked payout:**
Open Payments → see "Blocked" KPI → drill Org → Clinic → claim labelled "no bank" →
**no next step available in-page** (must go to employee/claim detail).

**Journey D — reconcile a past payout:**
Open Payments → "Payment History" → scan references → click payment ref → printable
advice PDF.

**Journey E — prepare a batch for the bank (desired, missing):**
Open Payments → select N ready claims → "Prepare payout" → review/download bank +
amount list → perform transfer externally → "Record" the batch.

Journeys A/B/D are supported; C lacks an in-page resolution path; E is absent.

---

## 26. Risks / Unknowns

1. **UI-only readiness invariant** — a future caller of `processPayments` without
   claimIds (or a script) could mark bank-missing claims paid.
2. **No bank snapshot on the ledger** — payout advice depends on claim immutability;
   a claim edited post-queue could diverge from what was reviewed.
3. **Divergent `/pay` route** — an external/client call could produce `paid` claims
   with stale `to_be_paid` PaymentRecords (ledger drift).
4. **Three bank sources** — ambiguity about which is authoritative; clinic bank fields
   are misleading.
5. **No payment batch** — bulk "mark all paid" is a financial action with no
   preparation/audit trail beyond the per-claim records.
6. **`paidBy` is a constant** — no real operator attribution.

---

## 27. Future SaaS Redesign Considerations

Payments is one page of a dashboard the client perceives as slow (§17 server + client
costs). The eventual global redesign should:

- Favor **flat, sortable, paginated tables** over nested drill-downs for financial data.
- Move aggregation off the client (server-side summary endpoints).
- Adopt a consistent financial-status color language (emerald = settled/ready,
  amber = blocked/attention, neutral = informational; retire the ad-hoc purple tone).
- Keep the Claims → Invoice → Payment mental model with a single, shared stepper.

---

## Future Rebuild Specification (proposal only — not implemented)

**Recommended organizing principle:** *payout states first, org/clinic as dimensions.*

A Payments workspace should be organized around three states (Ready / Blocked / Paid)
because that is what the operator actually acts on, with **organization and clinic as
filters/grouping**, not as the top-level hierarchy. A claim-level flat table is the
simplest model that preserves Super Admin power: every row is independently
selectable, filterable, and traceable to its claim + invoice, while org/clinic become
columns or group headers rather than mandatory drill-downs.

**Explicit three-stage payout flow** (preparation → external execution → recording)
should be surfaced, with "prepare" producing a downloadable bank/amount list and
"record" writing the ledger — never implying the system moves money itself.

**Bank source of truth:** retain the claim snapshot as authoritative; retire or
explicitly wire the clinic-directory bank fields (today they are dead); freeze the
bank into the PaymentRecord at recording time to close the snapshot gap.

**Backend hygiene (deferred, not in scope to fix here):** deprecate the single
`/pay` and direct `queue-payment` routes in favor of `processPayments` and
`markInvoicePaid` (the ledger-consistent paths), and consider making bank-completeness
a backend invariant if the client confirms it is a hard rule.

---

## UNRESOLVED BUSINESS QUESTIONS

| # | Question | Why it matters | Current implementation | Recommended default if client doesn't specify |
|---|---|---|---|---|
| 1 | Is "valid bank details required" a hard rule or a soft hint? | Determines whether readiness must be enforced in the backend | UI-only gate; backend pays regardless | Hard rule → enforce in `processPayments` |
| 2 | Which bank source is authoritative — claim, employee, or clinic? | Three sources exist; clinic is dead but advertised | Claim snapshot (employee fallback) | Claim snapshot; retire clinic bank fields |
| 3 | Is 14-day "overdue" an agreed SLA? | The "Overdue" KPI/aging is invented if not | Hard-coded `OVERDUE_DAYS = 14` | Ask client; default to a neutral "queued N days" label if unspecified |
| 4 | Is direct queue-without-invoice a supported operation? | Two queue paths with different ledger behavior | `queue-payment` route (no PaymentRecord write) | Deprecate; queue only via invoice-paid |
| 5 | Should the single `/pay` route exist? | Produces `paid` claims without a finalized ledger record | Exists, unused by UI | Deprecate; use `processPayments` only |
| 6 | What is the right "paid" reporting window? | "Paid Today" KPI may not match finance cadence | Calendar day | Ask client; default to "this week" rollup |
| 7 | Should the payout recipient/bank be snapshotted on the ledger? | Financial integrity if a claim is edited post-queue | Re-read from claim at print time | Yes — snapshot bank into PaymentRecord at recording |

---

## BLOCKERS

None for the audit itself. The audit is complete and documented. No implementation
was performed.
