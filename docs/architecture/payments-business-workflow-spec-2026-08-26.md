# Payments Business Workflow Specification

**Phase 4B — Architecture & business workflow lock. No implementation.**
**Purpose:** Lock the business and architectural semantics of the **Payments** (clinic/recipient payout) portion of the Super Admin financial workflow, so the rebuild is done once against an agreed contract.
**Date:** 2026-08-26
**Precedes:** Phase 4A Payments audit (`docs/audits/payments-ux-ui-workflow-audit-2026-08-26.md`).

This document produces **decisions, not code**. Where a rule is directly supported by the client's completed questionnaire/meeting material it is tagged `CLIENT-CONFIRMED`; where it is derived from the already-verified backend it is tagged `INFERRED FROM EXISTING ARCHITECTURE`; where the material does not establish it, it is tagged `UNRESOLVED` and routed to §28.

---

## 1. Scope

This specification locks the business/architectural semantics of the **payout** half of the workflow — everything *after* an organization pays its invoice:

- What makes a claim "ready to pay" (payout eligibility)
- The payout recipient and the source of truth for bank details
- The three stages of a payout: **prepare → external transfer → record**
- Individual vs. bulk payout
- Payment grouping
- Blocked (missing-bank) behavior
- Paid history and reconciliation
- Corrections / reversals / duplicate-payment safety
- References, notes, dates
- Privacy / export
- Traceability (claim ↔ invoice ↔ payment)
- Notifications
- Information architecture and the future rebuild blueprint

**Out of scope (unchanged, authoritative):**
- The claim state machine `approved → to_be_paid → paid` — **not changed**.
- Claims workspace and the Claims → Invoice flow (finalized in Phase 3).
- Organization-payment recording (the *other* financial operation — see §2) — referenced only at the boundary.
- Authentication, authorization, external banking, caching, the global SaaS redesign.

---

## 2. Existing Verified Financial Workflow

### 2.1 The two financial operations (never conflated)

| | **Organization payment** | **Payout** |
|---|---|---|
| Direction | Money **IN** to Remedy (org → Remedy) | Money **OUT** of Remedy (Remedy → clinic/employee) |
| Trigger | Super Admin records org payment | Super Admin records payout |
| Effect on invoice | `issued → paid` | *(none)* |
| Effect on claim | `approved → to_be_paid` (queues each linked approved claim) | `to_be_paid → paid` |
| Ledger | Invoice document (`paidAt`/`paidBy`) | `PaymentRecord` (`paidAt`, `paidBy`, `paymentReference`, `bankReference`) |
| Recorded where | Invoices/billing context | **Payments workspace** |

The Payments workspace is about the **second** operation only. `SOURCE: architecture` (Phase 4A audit; `invoiceService.markInvoicePaid`; `paymentService.processPayments`).

### 2.2 The payout operation has three distinct stages

```
PREPARE        — gather who/how much/which bank/which invoice, into a reviewable + exportable form
EXECUTE        — the external bank transfer (outside RemedyGCC; the system does NOT do this)
RECORD         — write the ledger that the transfer happened
```

The client explicitly confirmed the system **does not transmit money**; it *prepares*, *reports*, and *records*. `CLIENT-CONFIRMED` (Master Context §2 "Critical interpretation", §14 "Payments Is Not a Bank Transfer Interface").

### 2.3 The canonical end-to-end sequence (frozen)

```
Invoice issued
  → org pays externally (off-platform)
  → Super Admin records org payment      → invoice `issued → paid`
  → linked approved claims auto-queue     → claim `approved → to_be_paid` (+ PaymentRecord, invoiceId)
  → Payments workspace (payout queue)
  → external clinic/employee transfer executed (off-platform)
  → Super Admin records payout            → claim `to_be_paid → paid` (+ PaymentRecord finalized)
```

`CLIENT-CONFIRMED` (Master Context §2, §43 truth table) and `INFERRED FROM EXISTING ARCHITECTURE` (matches `markInvoicePaid → queueForPayment → processPayments`).

### 2.4 Claim state machine (unchanged)

```
approved → to_be_paid → paid        (rejected / frozen are tenant-review side states)
```

`paid` is terminal in the current implementation. Whether a **deliberate, audited override** is allowed to re-record a payment is the single open conflict — see §14 and §28.

---

## 3. Client-Confirmed Requirements

Extracted from `RemedyGCC_Super_Admin_Financial_Workflow_Master_Context.md` (the client's completed questionnaire + Aug 16 meeting notes). These are treated as authoritative product intent:

1. Two primary workspaces: **Claims** and **Payments** (Invoices remain a first-class business object inside the billing flow).
2. The system **prepares, reports, and records** payouts; the actual money transfer is **external**.
3. The Payments workspace answers: *"What is ready for payout, what information is needed, and what has been paid?"*
4. **Bank details are required at claim submission**; a claim cannot be submitted without them (new claims).
5. **Bank details are a claim-level historical snapshot** — later profile changes do not alter an existing claim's payout destination.
6. A claim with **missing/incorrect bank details is blocked/flagged**, but **other ready claims continue** — one bad claim must not block unrelated ones.
7. Missing-bank resolution is **external** (Remedy staff contact the employee/clinic to obtain the correct information).
8. **Payment completion is claim-level** — a group is not marked paid as a unit; each claim is recorded individually.
9. **Individual control is preserved** — bulk accelerates but does not replace single-claim actions.
10. **Bulk = select → prepare/report → record**, with Select All + remove-selected, and state-aware actions (no dangerous mixed-state action).
11. Payment recording captures **payment date, amount, bank/payment reference, payment method, and notes**, and states explicitly *"Payment is completed outside RemedyGCC. Record it here after it has been sent."*
12. **Duplicate-payment safety** = allow another payment action **with a strong, reason-based, audited warning/override**.
13. Long-term **traceability** — claim ↔ invoice ↔ organization payment ↔ clinic payout must be navigable six months later.
14. **Notification after payment recording** — employee/clinic notification and email.
15. The Payments workspace shows clinic **grouping** (combined view) **and** individual claim rows, with filters for organization/clinic/status/bank-completeness/date/amount/reference.
16. **Aging** (days in To Be Paid) is the operational delay signal — not an invented fixed "overdue" threshold.

`SOURCE:` Master Context §2, §13, §14, §15, §16, §17, §18, §19, §20, §25–§31, §34, §35, §37, §42.

---

## 4. Payment Eligibility

### 4.1 The precise rule

```
READY FOR PAYOUT (backend queue membership):
      claim.status == "to_be_paid"

WITHIN the queue, the client distinguishes two derived conditions:

      READY   = to_be_paid  AND  effective bank account AND bank name both present
      BLOCKED = to_be_paid  AND  effective bank missing

      Effective bank = claim snapshot (bankSource "claim")
                    → else employee profile (bankSource "employee_fallback", legacy only)
                    → else "missing"
```

**DECISION:** A claim becomes part of the payout queue only through the org-payment path (`approved → to_be_paid`). Within the queue, **"ready" vs "blocked" is a derived condition on bank completeness**, not a new claim status. The claim status remains `to_be_paid`; a blocked claim is simply a `to_be_paid` claim lacking bank details.

**WHY:** The client confirmed the *blocked* model (Option B in the question set): a claim with missing bank is flagged/blocked while siblings proceed — it does not silently become "ready", and it does not vanish from Payments. `CLIENT-CONFIRMED` (Master Context §18; §42 rules #10, #12).

**SOURCE:** client §18 (blocked/flagged, others continue); architecture (bank resolution `bankSource: claim | employee_fallback | missing`).

**TECHNICAL IMPACT:** No state-machine change. The readiness rule must be computed identically by backend and frontend. The backend should **surface** `bankSource`/blocked-reason (it already does) and, defensively, **reject** recording a missing-bank claim (see §12 and §24).

### 4.2 Bank is required at claim submission (new claims)

The client's rule is that bank details are **required at claim submission** — an employee cannot submit a claim without them. `CLIENT-CONFIRMED` (Master Context §17, §42 #10). Therefore "blocked at payout" is a **legacy/exception** condition (old claims predating bank capture, or data-entry gaps), not the normal path. The workflow must still handle it gracefully (§12).

---

## 5. Bank Details / Payee

### 5.1 Source of truth for bank details

**DECISION:** The **claim-level bank snapshot** (`ReimbursementDocument.bankAccountNumber` / `bankName`) is the single source of truth for a payout. If the employee later changes their profile bank, an existing claim retains its original bank.

**WHY:** The client explicitly required a claim-level snapshot precisely so "historical payout destinations do not silently change." `CLIENT-CONFIRMED` (Master Context §17).

**SOURCE:** client §17; architecture (claim carries `bankAccountNumber`/`bankName`; `InvoiceLineItem` also carries a copy).

**TECHNICAL IMPACT:** The employee-profile bank remains only as a **legacy fallback** for claims that predate bank capture (`bankSource: "employee_fallback"`), and must be **visibly labelled** as such so the operator knows they are paying a profile bank, not a claim-captured bank. The admin **clinic-directory bank fields** are dead (§24.3) and should be retired unless the client intends clinics as recipients (§28).

### 5.2 Who is the payee?

**DECISION:** The **payee is the employee** — the payout destination is the employee's bank account captured on the claim. The **clinic is a grouping/labelling dimension for operational review**, not the recipient.

**WHY:** Bank details are supplied by the employee at claim submission (§3.2, Master Context §3 "Employee — supply bank details", §17) and stored on the claim. Grouping is by clinic (§15), but the money goes to the employee's account.

**SOURCE:** `INFERRED FROM EXISTING ARCHITECTURE` (bank lives on the claim, which belongs to an employee) + client §17 (employee supplies bank).

**TECHNICAL IMPACT:** The payment record's *recipient identity* is the employee (derived from the claim). The clinic appears as a label. **Flag for one-line confirmation** (§28.3): the client's material interchangeably says "clinic/recipient" and "employee/recipient", and the dead clinic-directory bank fields imply a possible "clinic as recipient" concept that was never wired — this should be settled explicitly.

---

## 6. Payment Preparation

**DECISION:** Before the external transfer, the Super Admin must be able to **prepare** a payout — a reviewable screen plus a **downloadable payment report** listing, per recipient: clinic, employee/recipient, claim reference, amount, bank information, related invoice, and payment status.

**WHY:** Actual payment is external; the client's "bulk payment" is *primarily* preparation of information. The canonical bulk action is literally **"Generate Payment Report"**. `CLIENT-CONFIRMED` (Master Context §30, §36).

**SOURCE:** client §30 ("Generate Payment Report"), §36 ("Payment report — clinic, employee/recipient, claim reference, amount, bank information, invoice reference, payment status, payment reference").

**TECHNICAL IMPACT:** The rebuild must produce a preparation artifact (report) — this is the *missing* stage in the current implementation (which jumps straight from review to "Mark Paid"). Format (PDF vs CSV/Excel) is **UNRESOLVED** (§28.7); recommend CSV/Excel for bank upload plus a printable PDF advice (the existing `PrintablePayment` is a starting point).

---

## 7. External Bank Transfer

**DECISION:** The transfer is executed **entirely outside RemedyGCC** (bank/email/other external process). The system has **no** bank integration, no reconciliation against the bank, and must not imply it does.

**WHY:** The client explicitly stated the system is *not* a banking/payment-transfer system. `CLIENT-CONFIRMED` (Master Context §2, §14, §42 rule #24 "No fake bank integration").

**SOURCE:** client §2, §14, §42 #24.

**TECHNICAL IMPACT:** No bank API, no transfer execution, no automatic reconciliation. The only coupling is the optional **bank/transfer reference** the operator captures when recording (§15).

---

## 8. Payment Recording

### 8.1 What "Record Payment" means

**DECISION:** Clicking **"Record Payment"** means: *"The money has already been transferred externally, and I am recording that in RemedyGCC."* It marks the claim `paid` and finalizes the ledger record. It does **not** move money.

**WHY:** The client required this exact framing — the recording UI must state *"Payment is completed outside RemedyGCC. Record it here after it has been sent."* `CLIENT-CONFIRMED` (Master Context §16).

### 8.2 Fields captured at recording

| Field | Required? | Current implementation |
|---|---|---|
| Payment date (actual transfer date) | **Yes** | ❌ not captured — `paidAt` is a server timestamp at record time |
| Amount | **Yes** (full claim amount) | ✅ implicit (claim amount) |
| Bank / payment reference | Optional | ✅ (`bankReference`, optional) |
| Payment method | Optional (client listed it) | ❌ `method` field exists but is never written/exposed |
| Notes | Optional | ❌ backend accepts `notes`, dialog does not expose it |

**DECISION:** The recording UI must capture **payment date** (the actual transfer date, which may differ from the recording date), **bank/payment reference** (optional), **method** (optional), and **notes** (optional). The system-generated `paymentReference` (`PAY-YYYY-NNNNNN`) remains the internal identifier.

**WHY:** `CLIENT-CONFIRMED` (Master Context §16 lists "payment date, amount, bank/payment reference, payment method, notes"). The **payment date** answer is Option A — the date the transfer *happened*, operator-entered, distinct from when it was recorded.

**SOURCE:** client §16; architecture (current `processPayments` writes `paidAt = now`, `paymentReference`, `bankReference`, `notes`).

**TECHNICAL IMPACT:** Add an operator-entered **`paymentDate`** field distinct from a system **`recordedAt`** (audit) and keep `paidBy`. Wire the existing-but-unused `method` and `notes` through the dialog. See §26.

---

## 9. Individual Payments

**DECISION:** Single-claim payout is fully supported: select one claim → review (employee, clinic, bank, amount, funding invoice) → transfer externally → record that one payment.

**WHY:** The client wants individual control preserved; "one bad claim does not block unrelated claims"; exceptions are handled individually. `CLIENT-CONFIRMED` (Master Context §13, §31).

**SOURCE:** client §13, §31.

**TECHNICAL IMPACT:** The per-claim "Record" action reuses the same `processPayments` service with a single `claimIds` entry (consistent ledger behavior). Keep it.

---

## 10. Bulk Payments

### 10.1 What "bulk" means

**DECISION:** Bulk is **select → prepare/report → record**, not "auto-mark-everything-paid". The operator selects the claims they are paying (manual select + Select All + remove-selected), reviews them, generates a report for the external transfer, and then records the completed ones.

**WHY:** The client's general bulk model is "Select → determine valid actions → show only safe actions → confirm → execute → summarize → show next step", and for `to_be_paid` claims the valid actions are "prepare/export payment information" and "record payment where business-safe" — never a blind combined transfer. `CLIENT-CONFIRMED` (Master Context §25, §27, §30, §31).

**SOURCE:** client §25, §27, §30, §31.

**TECHNICAL IMPACT:** The current "Record N Payments" (all-ready-in-one-confirm) is **not** the agreed bulk model — it skips selection and preparation. The rebuild must introduce explicit **selection** and a **preparation/report** step before recording. No payment-batch *entity* is required (the client did not ask for a persisted batch); selection is transient client state.

### 10.2 Scope of bulk

**DECISION:** Bulk operates on **`to_be_paid` claims only**. No bulk "Mark Paid" for `approved` claims, no direct payout shortcut, no tenant-review actions. Mixed-status selections show only universally valid actions (export/view) and never a dangerous combined action.

**WHY:** `CLIENT-CONFIRMED` (Master Context §27, §28).

---

## 11. Payment Grouping

**DECISION:** Claims are grouped by **clinic** (within organization) for the combined view, with individual claim rows underneath. The client wants **both** the clinic-level combined total **and** the claim-level rows.

**WHY:** `CLIENT-CONFIRMED` (Master Context §15: "clinic-level combined view + individual claim-level view"; §30 "8 clinics" in the report).

**SOURCE:** client §15, §30.

**TECHNICAL IMPACT:** Grouping by clinic is a **display/grouping concern**, not a recording boundary — recording remains claim-level. Grouping by bank account is a reasonable *secondary* convenience (the current dialog already groups identical-context claims) but is not a client requirement.

---

## 12. Blocked Payments

**DECISION:** A `to_be_paid` claim with missing bank details is **"Blocked — missing bank details"**, shown distinctly from "ready", and does not block other ready claims. The Super Admin can see **which** detail is missing and is directed to **contact the employee/clinic externally** to obtain it (no in-app bank capture is required).

**WHY:** `CLIENT-CONFIRMED` (Master Context §18: "C should be blocked/flagged, but A/B/D should continue"; "Remedy staff contact the person and obtain the correct information externally").

**SOURCE:** client §18; §42 #12 ("one problematic claim does not block unrelated valid claims").

**TECHNICAL IMPACT:**
- The UI must expose a specific **blocked reason** (which bank field is missing) and an external-resolution instruction — the current implementation only shows a generic "no bank" label.
- The backend should **defensively reject** recording a missing-bank claim (currently `processPayments` pays any `to_be_paid` claim regardless of bank). This is a hardening of the client's rule, not a state-machine change.

---

## 13. Paid History

**DECISION:** Paid payouts are retained as a **reconciliation trail** — a searchable history of completed payments (payment reference, bank reference, claim, invoice, clinic, organization, amount, date, recorded-by).

**Search/filter fields the client actually uses** (`CLIENT-CONFIRMED`, Master Context §34): claim/reference number, invoice number, payment reference, employee/recipient, clinic, organization, payment date, amount range, payment status.

**TECHNICAL IMPACT:** The rebuild must provide server-side search/filter on these fields (the current history is client-filtered with no search/sort). "Paid By" is the constant string `"super-admin"` — low value; move it to detail or make it a real actor identity.

---

## 14. Corrections / Reversals

**DECISION:** Corrections and reversals are **not** freely editable. A recorded payout is a financial record; changing it requires a **reason-based, audited** action, not an inline edit.

**WHY:** The client's material establishes a reason-based override *pattern* (for duplicate payments, §19) but does **not** explicitly authorize inline editing of a recorded payout's reference/date. Editing financial records must not be assumed. `UNRESOLVED` — routed to §28.

**SOURCE:** client §19 (override pattern) and §42 #23 (traceability), but no explicit "edit/reverse a recorded payout" rule.

**TECHNICAL IMPACT:** Two open questions (§28.4, §28.5) determine whether a correction/reversal endpoint is needed and what shape it takes (adjustment record vs. state reversal). The current `paid`-terminal state machine has **no** reversal path.

### Duplicate-payment safety (the key conflict)

**CLIENT RULE:** *"allow another payment action with a strong warning"* — a visually dangerous, reason-based, audited override ("⚠ This claim is already marked Paid… Reason: [__] [Cancel] [Continue]"). `CLIENT-CONFIRMED` (Master Context §19).

**CURRENT IMPLEMENTATION:** `paid` is terminal; `assertValidTransition` rejects `paid → paid`; `processPayments` filters to `to_be_paid`; `PaymentRecord.claimId` has a **unique index** (one record per claim). A second payment is **impossible** today — and the dialog's comment claiming "already-paid claims are excluded" is not even implemented in the dialog (it relies solely on the upstream `to_be_paid` filter).

**CONFLICT:** The client's duplicate-payment override is **not implementable** against the current model without a design decision: (a) keep `paid` terminal and add a separate *adjustment/correction* ledger record, or (b) relax the terminal state + unique index to allow an audited second record. Neither is established by the material. **SURFACED — see §28.1.** This is the highest-priority open item.

---

## 15. Payment References / Notes

**DECISION:** The system stores an internal **payment reference** (`PAY-YYYY-NNNNNN`, auto-generated) and an optional operator **bank/transfer reference**. A **note** is optional. A missing bank reference is tolerated (the internal reference always exists).

**WHY:** The client lists "bank/payment reference" and "notes" among captured fields, and the exception list includes "missing payment reference" as a handled case (implying the bank reference may be absent). `CLIENT-CONFIRMED` (Master Context §16, §33 exception #10).

**SOURCE:** client §16, §33 #10.

**TECHNICAL IMPACT:** The internal reference is already generated. Add `notes` (and `method`) to the recording dialog. The internal reference and the operator's bank reference must both appear in history/print (they already do).

---

## 16. Payment Privacy

**DECISION:** Bank details must be **visible to the Super Admin** in the payout workspace (they are needed to make the transfer). `CLIENT-CONFIRMED` (Master Context §14 "bank account/name", §30 "bank information").

**Open sub-question (UNRESOLVED, §28.6):** whether sensitive values are **masked** in history/print (e.g. `XXXX XXXX 1234`) or shown in full. The existing `PrintablePayment` masks to last-4. Recommendation: full visibility where operationally needed (the Ready/record flow); masked-by-default in history/print with reveal — pending client confirmation.

---

## 17. Claim ↔ Payment Traceability

**DECISION:** The following navigations are mandatory:

| Navigation | Required? | Current state |
|---|---|---|
| Claim → Payment | **Yes** | ✅ works (claim detail shows the payment record + reference) |
| Payment → Claim | **Yes** | ✅ works (`PaymentRecord.claimId` → claim) |
| Payment → Recipient/bank | **Yes** | ⚠️ derived from the claim, **not snapshotted on the record** |

**WHY:** The client requires the conceptual chain `Claim → Invoice → Organization Payment → Clinic Payment` to be explainable six months later. `CLIENT-CONFIRMED` (Master Context §20, §42 #23).

**SOURCE:** client §20; architecture.

**TECHNICAL IMPACT:** The claim→payment direction already works. The **recipient/bank derivation** relies on claim immutability (only `paid` is read-only today); see §24.4 on snapshotting.

---

## 18. Invoice ↔ Payment Traceability

**DECISION:** Payment → Invoice is mandatory (the funding invoice must be visible from a payout). Invoice → Payout status should be navigable (from a funded invoice, see that its line items were paid out).

| Navigation | Required? | Current state |
|---|---|---|
| Payment → Invoice | **Yes** | ✅ works (`PaymentRecord.invoiceId`) |
| Invoice → Payout status | **Yes** | ⚠️ indirect — invoice links line items to claims, not directly to payouts |

**WHY:** `CLIENT-CONFIRMED` (Master Context §20: "for a payment … related invoice"; §43 truth table).

**TECHNICAL IMPACT:** Thread a payment reference/status onto the invoice line-item view (or a claim-level payout join) so the invoice → payout hop is one step, not two.

---

## 19. Organization ↔ Payment Workflow

**DECISION:** A claim reaches the payout queue **only** through the org-payment path: invoice `issued → paid` → linked `approved` claims `approved → to_be_paid`. There is **no** direct payout (or direct queue) that bypasses the organization payment.

**WHY:** `CLIENT-CONFIRMED` (Master Context §42 rules #4 "no Approved → Paid shortcut", #5 "organization payment precedes normal clinic payout", #7 "no direct Claims-page payout shortcuts").

**SOURCE:** client §42 #4/#5/#7; architecture.

**TECHNICAL IMPACT:** The two divergent routes found in the audit — `reimbursements/[id]/pay` (marks `paid` with no PaymentRecord) and `reimbursements/[id]/queue-payment` (queues `approved → to_be_paid` with no invoice/record) — are **not supported business operations** and must be **deprecated/removed**. The only supported payout path is `processPayments` on `to_be_paid` claims, reached via the org-payment flow.

---

## 20. Notifications

**DECISION:** After a payout is recorded, the **employee and clinic are notified** (in-app) and an **email** is sent. Exact recipients follow the existing notification architecture.

**WHY:** `CLIENT-CONFIRMED` (Master Context §37: "client expects employee/clinic notification and email after payment is recorded"; §2/§70 "relevant user receives notification").

**SOURCE:** client §37, §70.

**TECHNICAL IMPACT:** Do **not** implement notifications in this phase. Record this as a required downstream behavior so the recording service triggers the existing notification path (`payReimbursement` already emits a system event; confirm the employee/clinic email is wired).

---

## 21. Final User Journeys

Each journey is stated in plain business language first, then its technical implication.

### JOURNEY A — Single payout
**Business:** The Super Admin opens Payments, sees that one claim is ready, reviews who to pay and how much, makes the transfer at the bank, returns, and records that one payment. The claim shows as Paid.
**Technical:** Per-claim "Record" → `PaymentRecordDialog` (single claim) → `processPayments([claimId])`. No change beyond adding date/method/notes fields.

### JOURNEY B — Bulk payout
**Business:** 25 claims are ready. The Super Admin selects the 15 being paid today, reviews them grouped by clinic, generates a payment report, makes the transfers, returns, and records the 15 completed payments.
**Technical:** Selection state (claim-level) → "Generate Payment Report" (preparation artifact) → record the selected subset via `processPayments(claimIds)`. Requires the **preparation/report** stage that is currently missing.

### JOURNEY C — Blocked payout
**Business:** A claim is missing bank details. The Super Admin sees it flagged as "Blocked — missing bank details", sees *which* detail is missing, and is directed to contact the employee/clinic externally. Other ready claims proceed unaffected.
**Technical:** Surface `bankSource === "missing"` with a specific reason + external-resolution instruction; do not let it block unrelated claims. Optional defensive server-side rejection.

### JOURNEY D — Already-paid claim
**Business:** The Super Admin opens a claim that is already Paid. The system flags it clearly and — per the client's override rule — warns that another payment may be a duplicate, requires a reason, and is audited.
**Technical:** **Blocked by the current terminal state machine** — needs a design decision (§28.1) before this journey can be fully implemented.

### JOURNEY E — Payment history
**Business:** The Super Admin finds a payout from three months ago by claim number, invoice, reference, clinic, organization, or date.
**Technical:** Server-side search/filter on the paid history (currently client-filtered, no search).

### JOURNEY F — Incorrect payment / correction
**Business:** A payout was recorded with the wrong reference or date. The Super Admin needs a controlled, audited way to correct it (not a free edit).
**Technical:** **Unresolved** (§28.4) — requires a correction/adjustment model; no such path exists today.

### JOURNEY G — Organization payment → payout readiness
**Business:** The Super Admin records that the organization paid its invoice. The system immediately reports "N linked claims are now ready for clinic payout" and offers **Review Payments**.
**Technical:** `markInvoicePaid` already queues the claims; the org-payment success banner must offer "Review Payments" (the current Payments success banner instead points "Back to Invoices" — a UX defect).

---

## 22. Information Architecture

**DECISION (recommendation):** One Payments workspace organized around **three payout states** — **Ready / Blocked / Paid** — with **organization and clinic as grouping/filter dimensions**, not as a mandatory drill-down tree.

**WHY:**
- The client's first question for Payments is *"what is ready, what needs information, what is paid"* (§14, §22) — three states, not three nested levels.
- The client's model is **filters + grouping** (org/clinic/status/bank-completeness/date/amount/reference — §34), which a flat, filterable, claim-level table satisfies.
- A claim-level flat table preserves individual power (select any claim) while clinic grouping gives the combined view the client asked for (§15).

**SOURCE:** `INFERRED FROM EXISTING ARCHITECTURE` + client §14, §15, §22, §34. The client never explicitly chose "tabs vs. one filtered list"; the material's filter language (§34) and "guided workspace" (§22) support a single workspace with state filters.

**TECHNICAL IMPACT:** Replace the 3-level Org→Clinic→Claim drill-down with a flat claim table + org/clinic grouping + Ready/Blocked/Paid state filters. First screen = summary ("N ready · OMR X") + the ready list + one primary CTA (**Record Payment** for a selection; **Generate Payment Report** for preparation).

---

## 23. Business Rules (Source-of-Truth Register)

Consolidated register. `SOURCE` uses: `CLIENT-CONFIRMED`, `INFERRED FROM EXISTING ARCHITECTURE`, `UNRESOLVED`.

| # | Business rule | Source | Technical impact |
|---|---|---|---|
| R1 | Payout queue membership = `claim.status === "to_be_paid"` only | CLIENT-CONFIRMED + architecture | No state-machine change |
| R2 | "Ready" vs "Blocked" = derived bank-completeness, not a status | CLIENT-CONFIRMED (§18) | Surface `bankSource`; defensive server guard |
| R3 | Bank source of truth = claim-level snapshot (immutable) | CLIENT-CONFIRMED (§17) | Employee bank = legacy fallback only |
| R4 | Payee = employee (claim bank); clinic = grouping | INFERRED (+ flag §28.3) | Recipient identity derived from claim |
| R5 | Payout = prepare → external transfer → record (no banking) | CLIENT-CONFIRMED (§2, §14) | No bank integration |
| R6 | Recording captures date, reference, method, notes | CLIENT-CONFIRMED (§16) | Add `paymentDate`, wire `method`/`notes` |
| R7 | "Record Payment" = recording an already-made transfer | CLIENT-CONFIRMED (§16) | Copy/language lock |
| R8 | Payment completion is claim-level | CLIENT-CONFIRMED (§13) | No group-atomic "paid" |
| R9 | Bulk = select → prepare/report → record | CLIENT-CONFIRMED (§25, §27, §30) | Add selection + report; no batch entity |
| R10 | Individual control preserved | CLIENT-CONFIRMED (§31) | Keep per-claim record action |
| R11 | Blocked claim does not block others; resolve externally | CLIENT-CONFIRMED (§18, §42 #12) | Specific reason + external-resolution copy |
| R12 | Duplicate payment → strong, reason-based, audited override | CLIENT-CONFIRMED (§19) | **CONFLICT with terminal state — §28.1** |
| R13 | No direct payout/queue without org payment | CLIENT-CONFIRMED (§42 #4/#5/#7) | Deprecate `/pay`, `/queue-payment` |
| R14 | Traceability claim ↔ invoice ↔ payout, six-month | CLIENT-CONFIRMED (§20, §42 #23) | Snapshot/freeze + cross-links |
| R15 | Notification (employee/clinic + email) after recording | CLIENT-CONFIRMED (§37) | Downstream wiring (not now) |
| R16 | Aging (days in To Be Paid), not a fixed "overdue" | CLIENT-CONFIRMED (§35) | **Remove hard-coded `OVERDUE_DAYS = 14`** |
| R17 | Payment report/export required | CLIENT-CONFIRMED (§30, §36) | Preparation artifact |
| R18 | History searchable by ref/claim/invoice/clinic/org/date/amount | CLIENT-CONFIRMED (§34) | Server-side search/filter |
| R19 | Partial single-claim amount | UNRESOLVED (§28.2) | Recommend full-amount only |
| R20 | Correction/reversal of recorded payout | UNRESOLVED (§28.4, §28.5) | Recommend audited adjustment |
| R21 | Bank privacy/masking | UNRESOLVED (§28.6) | Recommend masked-by-default in history |
| R22 | Export format (PDF/CSV/Excel) | UNRESOLVED (§28.7) | Recommend CSV/Excel + printable PDF |

---

## 24. Technical Architecture Implications

### 24.1 Remove the hard-coded "overdue" threshold
`OVERDUE_DAYS = 14` and the "Overdue" KPI are **not client-established**. Replace with **aging** ("days in To Be Paid") as informational context. `CLIENT-CONFIRMED` (R16, §35).

### 24.2 Deprecate the divergent payout routes
`reimbursements/[id]/pay` and `reimbursements/[id]/queue-payment` are direct shortcuts that violate R13. Deprecate/remove them; keep `processPayments` and `markInvoicePaid` as the only ledger-consistent paths. `CLIENT-CONFIRMED` (R13).

### 24.3 Retire the dead clinic-directory bank fields
The admin clinic directory carries `bankName`/`bankAccountNumber` labelled "used by the payment queue" but never read by it. Unless the client confirms clinics are recipients (§28.3), retire these fields to remove the ambiguity. `INFERRED` + `UNRESOLVED` (payee confirmation).

### 24.4 Snapshot bank/recipient at finalization (defensive denormalization)
The client's authoritative rule is the **claim-level snapshot** (R3). The PaymentRecord does not need to duplicate it for correctness — but copying the effective bank + recipient onto the record at `paid` time is a cheap, defensible hardening that makes the payout ledger self-contained and immune to any post-queue claim edit. `RECOMMENDED` (not a client requirement). If the client confirms "snapshot on the ledger" (§28), make it explicit.

### 24.5 Enforce bank-completeness defensively
`processPayments` currently pays any `to_be_paid` claim regardless of bank. Add a server-side guard rejecting missing-bank claims (aligned with R2/R11), while the UI continues to pre-block them.

### 24.6 Replace O(n²) workspace query
`listPaymentOperations` performs `queue.reimbursements.find(...)` inside nested loops plus multiple full-table scans. Rebuild should resolve bank/employee/invoice via indexed lookups and add server-side pagination/search/sort (R18).

---

## 25. API Implications

*Not implemented now — this is the blueprint for the next phase.*

1. **Add `paymentDate`** to the payout input (operator-entered transfer date), distinct from the system `recordedAt`/`paidAt`. `CLIENT-CONFIRMED` (R6).
2. **Expose `method` and `notes`** through the record dialog/endpoint (fields already exist). `CLIENT-CONFIRMED` (R6).
3. **Server-side search/filter/sort/pagination** on the paid-history and ready-queue lists. `CLIENT-CONFIRMED` (R18).
4. **Defensive rejection** of missing-bank claims in `processPayments`. (R2/R11)
5. **Deprecate** `POST /reimbursements/:id/pay` and `/reimbursements/:id/queue-payment`. (R13)
6. **Payment-report/export endpoint** (or client CSV over a stable dataset) producing the §36 report fields. (R17)
7. **Invoice → payout join** so an invoice line item can surface its payout status/reference. (R14)
8. (Conditional) **Correction/reversal endpoint** if §28.4/§28.5 are confirmed. (UNRESOLVED)

---

## 26. Database Implications

*Not implemented now.*

1. **Add `paymentDate`** (operator-entered transfer date) to `PaymentRecordDocument`, keeping `paidAt`/`createdAt` as system audit timestamps. `CLIENT-CONFIRMED` (R6).
2. **Populate `method`** (currently dead) when the client confirms it is wanted (R6).
3. **(Recommended) Snapshot `bankAccountNumber`/`bankName`/`employeeName`** onto the PaymentRecord at finalization for a self-contained payout ledger. `RECOMMENDED` (24.4).
4. **No new status, no batch entity, no bank-integration schema.** `CLIENT-CONFIRMED` (R1, R9, R5).
5. **(Conditional) Correction/adjustment model** — a second ledger-entry type or an adjustment flag — only if duplicate-override (§28.1) and correction (§28.4) are confirmed. `UNRESOLVED`.

---

## 27. React/Next.js Implications

*Not implemented now.*

1. **Replace the 3-level drill-down** with a flat, filterable, claim-level table grouped by org/clinic, with Ready/Blocked/Paid state filters (§22).
2. **Add a payment-preparation step** ("Generate Payment Report") and a selection toolbar (count/total/select-all/remove) (§10).
3. **Extend `PaymentRecordDialog`** to capture date, method, notes, and a specific blocked-reason — and replace its misleading "already-paid excluded" comment with a real guard or remove the comment (§14).
4. **Reuse shared financial primitives** (`formatCurrency`, `FinancialRecordLink`, `ConfirmActionDialog`, skeleton/empty/error components) instead of the page-local duplicates found in the audit.
5. **Fix the success destination** — payout success should point to "Payment History", not "Back to Invoices" (Journey G).
6. **Remove the full-page spinner** on the payment detail page (align with Phase 3's no-full-page-spinner standard).
7. **Specific blocked-reason + external-resolution copy** for bank-missing claims (§12).

---

## 28. Unresolved Questions

Only questions the source material genuinely does not answer. Each must be confirmed by the client before implementation.

1. **Duplicate-payment override (§14, R12).** The client wants "allow another payment with a strong warning." The frozen state machine makes `paid` terminal with a unique `claimId` index, so a second payment is impossible. **Does the client want (a) an audited *adjustment/correction* ledger entry (keep `paid` terminal), or (b) a genuine second payment record (requires relaxing the terminal state + unique index)?** This is the highest-priority open item.
2. **Partial single-claim amount (§28 R19).** Is a payout always the full claim amount, or can the Super Admin record a partial amount (e.g. OMR 80 of 100)? Material is silent; recommend full-amount only.
3. **Payee confirmation (R4).** Is the recipient **always the employee** (whose bank is on the claim), or can a **clinic** be the recipient (the dead clinic-directory bank fields imply a clinic-recipient concept that was never wired)?
4. **Payment correction (R20, Journey F).** If a reference/date is recorded wrong, is correction allowed — and via *edit*, *adjustment*, or *support contact*? Material implies "audited, reason-based" but does not specify a path.
5. **Payment reversal (R20).** Is "undo/reverse a recorded payout" ever allowed? Material is silent; recommend a reason-based reversal rather than free undo.
6. **Bank privacy/masking (R21).** Full bank details vs. masked (`XXXX XXXX 1234`) — and where? Recommend full in the record flow, masked-by-default in history/print.
7. **Export format (R22).** PDF, CSV, Excel, or a combination for the payment report? Recommend CSV/Excel for bank work plus a printable PDF advice.
8. **Overdue vs aging (R16).** Confirm there is **no** fixed "overdue after N days" SLA, so the 14-day threshold is removed in favor of "days in To Be Paid" aging.

---

## 29. Risks

1. **Duplicate-payment model unresolved (R12)** — if implemented naively, re-opening the terminal state could corrupt the ledger; if left unresolved, the client's explicit override requirement is unmet.
2. **Bank snapshot relies on claim immutability (R3/24.4)** — claims are only read-only at `paid`; an edit between queue and payout could diverge from what was reviewed.
3. **UI-only readiness gate (R2)** — a future caller of `processPayments` without claimIds could mark bank-missing claims paid.
4. **Dead clinic bank fields (R3)** — ambiguous "clinic as recipient" concept could surface the wrong payout destination if ever wired without confirmation.
5. **Direct payout routes (R13)** — if left in place, external clients could produce `paid` claims with no finalized ledger record.
6. **Notification wiring (R15)** — if the payout path does not trigger the employee/clinic email, the client's notification expectation is silently unmet.

---

## 30. Future Payments Rebuild Specification

*Not implemented — this is the blueprint for the next phase, ordered by business priority, not code.*

**Organizing principle:** payout **states first** (Ready / Blocked / Paid), with **organization and clinic as grouping/filter dimensions**; a **flat, claim-level table** as the primary surface.

**Three-stage payout flow made explicit:**
1. **Prepare** — select ready claims, review grouped by clinic, generate a downloadable payment report (bank + amounts) for the external transfer.
2. **Execute** — off-platform (no integration).
3. **Record** — record the completed transfers individually (claim-level), capturing payment date, optional bank reference, method, and notes.

**Bank source of truth:** claim-level snapshot (authoritative); employee profile as labelled legacy fallback only; retire the dead clinic bank fields (pending §28.3).

**Backend hygiene (client-justified):** deprecate the direct `/pay` and `/queue-payment` routes; add defensive missing-bank rejection; replace the hard-coded 14-day "overdue" with aging; add operator-entered `paymentDate`; (recommended) snapshot bank/recipient onto the ledger at finalization.

**Open items gate the last mile:** duplicate-payment override model, correction/reversal model, payee confirmation, export format, and privacy/masking (§28) — these must be answered before the corresponding endpoints/UI are built.

---

## 31. Definition of Done (for the rebuild phase, when it arrives)

The Payments rebuild is complete when: the payout queue is claim-level and state-clear; bank source of truth is unambiguous; a blocked claim is flagged with a specific reason and does not block siblings; bulk means select → prepare → record; recording captures date/reference/method/notes; the "payment is external" framing is explicit; duplicate-payment safety behaves as the client finally confirms; claim ↔ invoice ↔ payout traceability is one-hop; history is searchable; and no fake banking is implied.
