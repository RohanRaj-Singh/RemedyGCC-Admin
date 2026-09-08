# Financial Hardening + Runtime E2E Verification

**Date:** 2026-08-26
**Phase:** 6 — hardening the five Phase-5 defects **and** running a live, seeded-data end-to-end verification of `CLAIMS → INVOICES → ORGANIZATION PAYMENT → TO_BE_PAID → PAYMENTS → PAID`.
**Method:** real code changes (backend invariant hardening) **plus** a runtime e2e against the real local MongoDB (`MONGODB_URI`), exercising the real service → repository → state-machine → `PaymentRecord` ledger paths — not the in-memory test store.

---

## 1. Phase Status

**PASS — LEVEL 2 (RUNTIME).**

Phase 5 produced a code-trace **PASS** with five non-critical defects. Phase 6 closed all five defects (plus the empty-selection API-safety gap) and then **converted the code-level verdict into a runtime verdict**: a seeded-data run of all 16 steps passed against the live database. The canonical workflow is unchanged; the frozen state machines, the `PaymentRecord` ledger, and the route surface were not redesigned.

---

## 2. Scope & Objectives

Two objectives, both complete:

1. **Harden the financial invariants** identified in Phase 5 (the five defects + the `NO_CLAIMS_SELECTED` empty-selection safety gap).
2. **Run a realistic seeded-data runtime verification** of the complete financial workflow (16 steps, persistent `runtime-e2e-*` data, inspectable in MongoDB after the run).

Hard-scope boundary held: no dashboard/Claims/Invoices/Payments redesign, no navigation/sidebar work, no caching, no broad React refactor, no payment batches/partial-payment, no new payment state, no `invoiced` claim status, no manual queue-payment route, and no redesign of `PaymentRecord`.

---

## 3. Hardening Completed

The five Phase-5 defects plus the empty-selection gap are **fixed** (not deferred):

| Finding | Severity | Fix | Location |
|---|---|---|---|
| #1 — `processPayments` ignores bank completeness | Medium | Rejects a `to_be_paid` claim missing `bankAccountNumber` or `bankName` with `reason: "missing_bank"`; no employee/clinic/live-employee fallback. | `tenantapp/src/server/services/paymentService.ts` |
| #2 — `processPayments` lacks claimId dedupe | Medium | Dedupes + trims claim ids up front (`["A","B","A","C"]` → `["A","B","C"]`, deterministic order); no mid-batch abort. | `tenantapp/src/server/services/paymentService.ts` |
| #3 — `markInvoicePaid` non-atomic | Low | Reordered: queue linked `approved` claims **first** (idempotent guard), then mark invoice `paid`. Failure-safe, no new transaction framework. | `tenantapp/src/server/services/invoiceService.ts` |
| #4 — invoice `paidBy` not persisted | Low | Added `paidBy?: string` to `InvoiceDocument`; `markInvoicePaid` now records it. | `tenantapp/src/server/db/documents.ts`, `invoiceService.ts` |
| #5 — vestigial `effective*` bank fields | Low | Removed `effectiveBankAccountNumber`/`effectiveBankName`/`bankSource` from `WorkspaceClaim`; `flattenQueue` reads `bankAccountNumber`/`bankName` directly. | `remedygcc-admin/src/lib/financial/payout.ts` |
| — empty `claimIds` = "pay all eligible" | **Important** | Absent/empty `claimIds` now throws `ApiError(400, "NO_CLAIMS_SELECTED", …)`. The super-admin can never pay "all eligible" because of an empty selection. | `tenantapp/src/server/services/paymentService.ts` |

---

## 4. Finding-by-Finding Detail

### Finding #1 — Bank completeness enforced (Medium)

`processPayments` now validates each target in a single pass before any payment: exists (`not_found`), tenant-scoped (`wrong_organization`), `status === "to_be_paid"` (`not_to_be_paid`), and `bankAccountNumber && bankName` both present (`missing_bank`). Each failure is collected into a `rejected: PaymentRejection[]` list while the remaining valid targets still process — multi-claim semantics preserved, one bad claim no longer aborts the batch.

### Finding #2 — ClaimId dedupe (Medium)

`const uniqueIds = Array.from(new Set(claimIds.map((id) => String(id).trim()).filter(Boolean)))` runs before any `findById`, so a duplicate id cannot be paid twice or throw a mid-batch `INVALID_STATUS_TRANSITION`.

### Finding #3 — Org-payment ordering (Low)

`markInvoicePaid` now queues linked `approved` claims **before** marking the invoice `paid`. The queue loop is guarded by `if (claim && claim.status === "approved")`, making it idempotent on re-execution. This removes the "invoice `paid` but claims still `approved`" failure mode without introducing a transaction framework (the repository layer exposes plain CRUD, no sessions). The reorder is the documented, failure-safe approach.

### Finding #4 — `paidBy` persisted (Low)

`InvoiceDocument` gained `paidBy?: string`; `markInvoicePaid` writes it alongside `paidAt`.

### Finding #5 — Vestigial `effective*` removed (Low)

Confirmed genuinely dead: the `?? ` fallback in `flattenQueue` was a no-op remnant of the removed employee-profile fallback. Removed with no change to the payout contract (the raw claim snapshot fields are used directly).

### Empty-selection safety (Important)

`if (!claimIds || claimIds.length === 0) throw new ApiError(400, "NO_CLAIMS_SELECTED", …)` — using the existing `ApiError`/`apiErrorResponse` conventions, so the admin proxy surfaces `{ error: { code: "NO_CLAIMS_SELECTED", … } }`.

---

## 5. Findings Fixed

All five Phase-5 defects plus the empty-selection gap: **fixed and verified** (unit tests + runtime). No finding was deferred on the backend invariants.

---

## 6. Findings Deferred

**None.** Every Phase-5 defect was fixed in this phase. (The three Phase-5 UX/performance *observations* — unreachable duplicate-warning dialog, `queuedAt` derived from `updatedAt`, and N+1 lookups in `listPaymentOperations` — remain out of scope per the hard-stop, unchanged from Phase 5.)

---

## 7. Runtime E2E — Method & Environment

- **Script:** `tenantapp/scripts/runtime-e2e-financial.ts` — imports the real services (`reimbursementService`, `invoiceService`, `paymentService`) and drives the real repository context against the real MongoDB.
- **Run:** `npx tsx --env-file=.env.local scripts/runtime-e2e-financial.ts` (equivalently `./node_modules/.bin/tsx --env-file=.env.local …`).
- **Environment:** real MongoDB at `mongodb://127.0.0.1:27017/remedygcc`, ping-verified in-script; `getRepositoryContext()` resolved with no in-memory fallback (asserted).
- **Data:** persistent, clearly-prefixed `runtime-e2e-org-a-<ts>` / `runtime-e2e-org-b-<ts>` tenants + `runtime-e2e-*` claims, so results are inspectable in MongoDB after the run.
- **Verdict rule:** LEVEL 1 code-trace (Phase 5, PASS) → LEVEL 2 runtime. Result: **PASS** (16/16 steps).

> Note on process exit: the repository's dev MongoClient holds a pooled connection for the app's lifetime, which keeps a script's event loop alive; the script closes its own client and then calls `process.exit(0)` to terminate cleanly.

---

## 8. End-to-End Results (16 runtime steps)

All 16 steps **PASS** against the real database (latest run, tenant `runtime-e2e-org-a-1787757756633`):

| # | Step | Result |
|---|---|---|
| 1 | Environment — real MongoDB reachable | PASS |
| 2 | Environment — repository context resolved (no in-memory fallback) | PASS |
| 3 | Seed — Employee A created | PASS |
| 4 | Seed — C1/C2 (bank-complete) + C3 (bank-missing) | PASS |
| 5 | State — C1, C2 approved (`pending → in_progress → approved`) | PASS |
| 6 | Invoice — issued → paid, `paidBy` recorded | PASS |
| 7 | State — `markInvoicePaid` auto-queued C1, C2 (`approved → to_be_paid`) | PASS |
| 8 | Payout — `processPayments` paid C1 + C2 (`processed=2, rejected=[]`) | PASS |
| 9 | Ledger — `PaymentRecord` finalized with all reconciliation fields | PASS |
| 10 | Blocked — C3 rejected `reason=missing_bank` (Finding #1) | PASS |
| 11 | Dedupe — `[C4, C5, C4]` → `processed=2`, no double-pay/abort (Finding #2) | PASS |
| 12 | Cross-org — Org B claim rejected `reason=wrong_organization` | PASS |
| 13 | Empty-selection — absent + empty `claimIds` → `NO_CLAIMS_SELECTED` | PASS |
| 14 | Refresh — outstanding=1 (C3), paymentHistory=4 paid | PASS |
| 15 | Traceability — `getPaymentDetail(C1)` resolves record+claim+invoice | PASS |
| 16 | Persistence — direct Mongo read: claim=paid, `PaymentRecord`=paid | PASS |

---

## 9. API Results

- `POST /api/admin/payments/process` requires explicit `claimIds`; empty/absent → `400 NO_CLAIMS_SELECTED`.
- Return shape is now `{ processed: number, rejected: { claimId, reason }[] }` with `reason ∈ { not_found, wrong_organization, not_to_be_paid, missing_bank }`.
- Admin proxy (`remedygcc-admin/.../super-admin/payments/process/route.ts`) forwards the body unchanged and surfaces the tenant app's `{ error }` payload on non-2xx; docstring updated to match.
- Runtime-verified: `wrong_organization`, `missing_bank`, `NO_CLAIMS_SELECTED`, and empty-`rejected` happy paths all behave as specified.

---

## 10. State Machine Results

No transition changed. Verified live:

- `pending → in_progress → approved` (C1, C2, C4, C5, C6) — legal.
- `approved → to_be_paid` remains controlled **only** by invoice settlement (`markInvoicePaid`), not by any manual queue route.
- `to_be_paid → paid` via `processPayments` only; `paid → (terminal)`; a bank-missing claim stays `to_be_paid` (rejected, not paid).
- No `invoiced` claim status introduced; no `to_be_paid → paid` bypass; no `PaymentRecord` bypass.

---

## 11. Payment Ledger Results

`PaymentRecord` invariant holds on every successful payout (runtime-asserted on C1):

- claim `status = "paid"`; `PaymentRecord.status = "paid"` (finalized).
- `PaymentRecord.claimId` = claim id (unique index).
- `invoiceId` preserved; `paymentReference` matches `/^PAY-\d{4}-\d{6}$/`.
- `bankReference`, `notes`, `paymentDate`, `method` all preserved when supplied.
- Direct Mongo read (step 16) confirms physical persistence — not in-memory.

---

## 12. Traceability Results

- `getPaymentDetail(C1)` resolves `record = paid`, `claim = paid` (bank `ACCT-C1`), and funding invoice number — runtime-verified.
- `tenantName` is a read-time join onto an actual tenant document; the synthetic `runtime-e2e-*` tenants have no tenant record, so `tenantName` is `undefined` in this run (expected; documented in-script).
- `PaymentRecord.claimId → claim`; `PaymentRecord.invoiceId → funding invoice`; claim↔invoice read-time join — all intact.

---

## 13. Test Results

| Suite | Result |
|---|---|
| `tenantapp` (`npx tsx --test`) | **268 passed, 0 failed** (up from 262; +6 net new: dedupe, missing_bank, not_found, wrong_organization, mixed dedupe+invalid, plus the empty-selection/multi-claim split) |
| `remedygcc-admin` financial (`src/lib/financial/tests/*`) | **55 passed, 0 failed** |
| Typecheck (`npx tsc --noEmit`) | **clean in both apps** (exit 0) |

---

## 14. Files Changed

Backend (`tenantapp`):

- `src/server/services/paymentService.ts` — hardened `processPayments` (bank completeness, dedupe, empty-selection `NO_CLAIMS_SELECTED`, `PaymentRejection` type, `{ processed, rejected }` return).
- `src/server/services/invoiceService.ts` — `markInvoicePaid` reordered (queue-first + idempotent guard) + `paidBy` persisted.
- `src/server/db/documents.ts` — `InvoiceDocument.paidBy?: string`.
- `app/api/admin/payments/process/route.ts` — docstring updated (required `claimIds`, `NO_CLAIMS_SELECTED`, `{ processed, rejected }`).
- `src/server/services/__tests__/payment.test.ts` — bank added to fixtures; empty-selection/multi-claim split; 6 new tests.
- `scripts/runtime-e2e-financial.ts` — **new** runtime E2E script (16 steps).

Admin (`remedygcc-admin`):

- `src/lib/financial/payout.ts` — removed vestigial `effective*` bank fields.
- `src/lib/financial/tests/payout.test.ts` — fixtures updated.
- `src/app/api/super-admin/payments/process/route.ts` — docstring updated.

---

## 15. Remaining Risks

- **Non-atomic org-payment under a hard infra failure mid-queue** (Finding #3): the queue-first reorder removes the "invoice `paid` but claims `approved`" mode for the common failure, but the repository layer has no transaction/session support, so a truly atomic all-or-nothing is not achievable without a transaction framework (explicitly out of scope). The idempotent queue guard makes re-execution safe.
- **No live bank transfer**: the workflow verifies the *ledger* end-to-end; actual money movement is out of scope.
- **`listPaymentOperations` N+1 lookups** (carried from Phase 5): correct, will not scale linearly to very large queues; a future batched lookup is the recommended optimization.
- The synthetic `runtime-e2e-*` tenants have no tenant document, so `tenantName` joins are empty in the seeded run (not a defect — a real tenant would populate it).

---

## 16. Document Created

This file: `remedygcc-admin/docs/audits/financial-hardening-runtime-verification-2026-08-26.md`.

**Recommended next phase:** none initiated (hard stop). When a live environment with real tenant records exists, a one-line follow-up re-run would additionally populate `tenantName`; otherwise the workflow is verified complete end-to-end at both code-trace and runtime levels.
