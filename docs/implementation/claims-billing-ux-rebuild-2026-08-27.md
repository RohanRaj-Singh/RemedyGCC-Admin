# Claims & Billing UX Rebuild — 2026-08-27

## Objective

Make Claims & Billing the single workspace a Super Admin uses to operate the
**CLAIM approved → INVOICE draft → ISSUE → ORGANIZATION PAYS → CLAIMS to_be_paid**
workflow. The workspace must immediately answer: what claims need attention,
which are ready to invoice, which are already invoiced, what invoice is
associated with a claim, what to do next, and what happens after a status
change. Invoices become a facet of Claims & Billing rather than a parallel
workflow.

## Problems Addressed

1. **Fragmented action surface.** Issue / Mark Paid / Archive buttons lived in
   three different places (Invoice list rows, Invoice detail, "edit" affordances
   that implied editability after issue). Operators couldn't tell at a glance
   which actions were legal on a given invoice.
2. **Dual-view toggle on Invoices list.** The page exposed two views
   (Invoices / Ledger) with a `view` state machine and per-row action buttons
   that duplicated the Invoice Detail page. The dual-view UI also leaked
   organization-context into the action surface, complicating the read model.
3. **Missing operational context.** Neither the list nor the detail surfaced
   the *current state* of the invoice in plain language ("Awaiting organization
   payment") or the next-step CTA ("Record payment", "Go to Payments"). Status
   was reduced to a pill with no prose.
4. **Claim ↔ invoice traceability was weak on the invoice side.** The Invoice
   list lacked a claim count and the per-claim link was buried.
5. **Invoice list filter & ledger were coupled.** A single search/filter box
   tried to serve both views, leading to inconsistent behavior.

## UX Decisions

1. **Invoices page = two sequential sections, one workspace.**
   - **Invoices** (filter: org + status) — read-only table; no per-row actions.
     Per-row actions move to the detail page.
   - **Accounts Receivable Ledger** (filter: days + search) — org-rolled aging
     summary; "View Invoices" deep-link per org. A/R ledger is a *summary*, not
     a row-level action surface.
   Both sections share the organization filter; each has independent pagination.
2. **Invoice detail = state-aware action surface.** A single `BillingActionBar`
   renders exactly one primary CTA per state (`draft` → Issue, `issued` →
   Record payment, `paid`/archived → read-only). Archive is a secondary control
   when legal.
3. **Operational language.** Every invoice state surfaces a prose
   `InvoiceStatusCallout` ("Awaiting organization payment… Record payment once
   it arrives.") with a built-in next-step CTA when the workspace's destination
   is unambiguous.
4. **Confirmation surfaces context before action.** Issue / Mark Paid / Archive
   all flow through `ConfirmActionDialog` with the invoice number and amount
   in the body. After pay, the success banner offers a "Go To Payments" deep
   link — never a silent state change.
5. **PDF export remains on the detail page** (one invoice at a time) and uses
   the browser's print pipeline (`window.print()`). CSV export remains on the
   list.
6. **Status badge and status callout are complementary, not redundant.** The
   badge sits at the top right of the header (compact, color-coded). The
   callout sits below the header (prose, action). Both pull from the same
   `INVOICE_STATUS_DISPLAY` / `INVOICE_STATUS_TONE` maps.
7. **No new financial states, no edit-after-issue.** Locked business rules
   are unchanged: draft → issued → paid → archived; once issued/paid/archived
   the invoice is read-only; no void/reissue/adjustment/credit-note systems;
   no date-range claim auto-selection; cross-organization selections remain
   rejected; invoice generation remains atomic; already-invoiced claims
   remain protected.

## Components Added / Modified

### New / extracted
- `src/components/financial/SelectionToolbar.tsx` — sticky `bg-gray-900`
  selection toolbar extracted from the Claims page so other workspaces can
  reuse the pattern.

### Modified (this phase)
- `src/app/reimbursements/[id]/page.tsx` (Claim Detail)
  - Replaced ad-hoc `STATUS_CONFIG` with shared `CLAIM_STATUS_DISPLAY` /
    `CLAIM_STATUS_TONE` + lightweight local `STATUS_DESCRIPTION` /
    `STATUS_TONE_CLASS` for visual nuance.
  - Collapsed three ad-hoc banners into three `FinancialNextAction` calls
    driven by `claim.status`.
  - `formatCurrency` now uses the shared 2-decimal formatter from
    `src/lib/financial/format.ts`.
- `src/app/invoices/page.tsx` (Invoices list)
  - Removed the dual-view toggle (`view` / `switchView`) entirely.
  - Removed per-row action buttons and the `runConfirmedAction` /
    `pendingAction` / `ConfirmActionDialog` infrastructure (moved to the
    detail page).
  - Now renders two sequential sections with independent pagination and
    independent load state (`inv*` vs `ledger*`).
- `src/app/invoices/[id]/page.tsx` (Invoice Detail)
  - Added `InvoiceStatusCallout` below the header.
  - Replaced inline per-button UI with `BillingActionBar`.
  - `runConfirmedAction` + `ConfirmActionDialog` retained for the three
    legal state transitions (issue/pay/archive) with state-aware copy.
  - Success banner preserves the "Go To Payments" deep link on pay.

### Untouched (preserved)
- `src/components/financial/PrintableInvoice.tsx`
- `src/components/financial/BillingActionBar.tsx` (already correct)
- `src/components/financial/InvoiceStatusCallout.tsx` (already correct)
- `src/components/financial/ConfirmActionDialog.tsx`
- `src/components/financial/SuccessBanner.tsx`
- `src/components/financial/FinancialExceptionBanner.tsx`
- `src/lib/financial/{status, format, eligibility, payout, selection, invoice, relativeTime}.ts`
- All API routes
- All backend services, Mongoose models, and seed data

## Pages Modified

| Route | File | Change |
|---|---|---|
| `/reimbursements/[id]` | `src/app/reimbursements/[id]/page.tsx` | Shared status system; next-action banners replace ad-hoc banners |
| `/invoices` | `src/app/invoices/page.tsx` | Dual-view toggle removed; two sequential sections with independent pagination |
| `/invoices/[id]` | `src/app/invoices/[id]/page.tsx` | `InvoiceStatusCallout` + `BillingActionBar` wired; inline per-button UI removed |

## Backend Dependencies Preserved

This phase is **frontend only**. The following backend contracts are
unchanged and authoritative:

- `GET /api/super-admin/reimbursements/:id`
- `GET /api/super-admin/reimbursements?status=…`
- `POST /api/super-admin/reimbursements/generate-invoice` (atomic claim set)
- `GET /api/super-admin/invoices?status=…&tenantId=…`
- `GET /api/super-admin/invoices/:id`
- `POST /api/super-admin/invoices/:id/issue`
- `POST /api/super-admin/invoices/:id/pay`
- `POST /api/super-admin/invoices/:id/archive`
- `GET /api/super-admin/invoices/:id/export`
- `GET /api/super-admin/tenants`
- `GET /api/super-admin/payments/:claimId` (best-effort linkage)

Service-layer validation remains authoritative:
- One invoice per organization (rejected cross-org selections).
- Invoice generation is atomic.
- Already-invoiced claims are protected.
- `processPayments` rejects `to_be_paid` claims missing bank info with
  `reason: "missing_bank"` (Phase-6 hardening).
- `PaymentRecord` unique index on `claimId` is enforced at the DB layer.

The frontend surfaces these via UI state; it does not duplicate or override
business rules.

## Verification

- **Type check:** `npx tsc --noEmit` clean across the admin app.
- **Visual smoke (manual):**
  - `/invoices` shows the two-section layout with independent pagination.
  - `/invoices?status=issued` filters to issued invoices.
  - `/invoices` ledger section lists orgs with outstanding totals.
  - `/invoices/[id]` for a `draft` invoice shows the draft callout + Issue /
    Archive actions.
  - Issuing an invoice shows the success banner and the page reloads to the
    `issued` callout ("Awaiting organization payment").
  - Marking paid shows the success banner with the **Go To Payments** deep
    link.
  - Archived invoices show the archived callout and no actions.
- **No scope creep:** diff confirmed only edits under
  `src/app/reimbursements`, `src/app/invoices`,
  `src/components/financial/SelectionToolbar.tsx`. No edits under
  `src/app/payments`, `src/app/page.tsx` (Dashboard), `src/server/**`,
  or shared lib files.

## Tests

Existing unit tests under `src/lib/financial/**` and `src/__tests__/**`
remain untouched and continue to pass. No new tests were added in this phase
because no service-layer or shared-formatter behavior changed — the changes
are presentation-only.

Recommended (deferred, not part of this phase):
- Component-level snapshot for `InvoiceStatusCallout` × four states.
- Component-level snapshot for `BillingActionBar` × four states.
- Interaction test for the dual-section `/invoices` page (filter changes
  reset `skip`).

## Before / After Behavior

### Invoice Detail page (before)
- Header + status badge only.
- Six inline buttons in a flex row: Issue, Mark Paid, Archive, Export CSV,
  Download PDF (and an "Edit" affordance that contradicted the locked
  read-only-after-issue rule).
- No prose explanation of the current state.
- Confirmation dialog copy hard-coded next to button onClick handlers.

### Invoice Detail page (after)
- Header + status badge.
- `InvoiceStatusCallout` reads in plain language and offers a built-in CTA
  when applicable (e.g., "View payments" once issued).
- `BillingActionBar` shows exactly one primary CTA per state plus Archive
  (secondary) where legal; CSV/PDF always available; archived = no further
  actions.
- Confirmation dialog copy is state-aware and includes invoice number +
  amount + claim count (for pay).
- Success banner preserves the **Go To Payments** deep link on pay.

### Invoices page (before)
- Single `view` toggle (Invoices / Ledger).
- Per-row action buttons duplicated the detail page.
- One shared filter box tried to serve both views.

### Invoices page (after)
- No toggle. Two sequential sections:
  - **Invoices** — read-only table; per-row navigation is the only action
    surface (links to the detail page).
  - **Accounts Receivable Ledger** — org-rolled aging summary; "View
    Invoices" deep-links to the filtered list.
- Per-section filter + pagination.
- "Paid this month" summary card above the ledger.

### Claim Detail page (before)
- Three ad-hoc banners (claim status, financial timeline, payment status)
  rendered with custom tone classes.
- Local `STATUS_CONFIG` defined display label, tone, description separately
  from the rest of the financial system.

### Claim Detail page (after)
- Single `FinancialNextAction` banner driven by `claim.status` (approved /
  to_be_paid / paid).
- Shared `CLAIM_STATUS_DISPLAY` / `CLAIM_STATUS_TONE` from the financial lib.
- Currency formatter matches the rest of the financial workspace.

## Deferred Work

Out of scope for this phase; explicitly excluded by the locked directive:

1. Payments workspace UX modernization (different phase).
2. Dashboard command center (different phase).
3. Admin / TenantApp architecture audit.
4. Performance, caching, and global React cleanup.
5. Chat, notifications, requests modules.
6. Adding new invoice states, edit-after-issue, void/reissue, adjustments,
   credit notes.
7. Date-range-based automatic claim selection.
8. Real-time / polling refresh of summary data.
9. Component-level test additions (noted under "Tests" above).