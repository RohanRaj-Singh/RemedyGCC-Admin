# Super Admin Financial Workspace — Redesign & Consolidation

**Date:** 2026-08-26
**Phase:** 7 — frontend-first consolidation + visual redesign of the Super Admin financial experience
**Status:** Implemented (verified with `tsc --noEmit` + 59 passing unit tests)

This document records what was actually implemented in Phase 7, the information
architecture it produces, and the design system it enforces. It is the design
source of truth for the financial workspace, not a record of intentions.

The financial core (claim state machine `pending → in_progress → approved →
to_be_paid → paid`; invoice state machine `draft → issued → paid → archived`;
the PaymentRecord ledger) was already hardened and verified in Phases 5–6. No
business logic was changed in this phase — it is presentation-only, as required.

---

## 1. Design Direction

The Super Admin financial surface is a **professional operations console** for a
person who reconciles money: bill organizations, issue invoices, collect
organization payment, pay clinics, reconcile history. The reference feel is
Stripe Dashboard + Linear + Ramp — calm, dense, numbers-forward, low-decoration —
without copying any of them.

Principles that govern every decision below:

- **Neutral foundation.** Gray surfaces (`bg-gray-50` page, white cards, gray
  borders) carry the layout. Color is reserved for meaning.
- **One primary accent.** The existing brand green (`--primary`,
  `hsl(156 63% 16%)`) is the single interactive accent for primary actions,
  active states, and the sidebar. No second accent.
- **Semantic color only for meaning.** success = emerald, warning = amber,
  error = red, info = blue, neutral = gray. Nothing else.
- **Numbers are the product.** Tabular figures, right-aligned amounts, thousands
  separators, two decimals. "OMR 12,450.00" must scan as money at a glance.
- **Anti-patterns are banned:** purple gradients, cyan-on-dark, neon,
  glassmorphism, AI-dashboard "vaporwave" styling, emoji as icons, decorative
  icons.

The bar: this must not read as a template, a Bootstrap panel, an AI-dashboard
generator output, a card farm, a prototype, or a dev panel.

---

## 2. Information Architecture

**Two primary operational workspaces**, not three pages in tabs. The navigation
answer was already ~90% present in the codebase; this phase completed and
named it.

| Workspace | Route | Question it answers |
|---|---|---|
| **Claims & Billing** | `/reimbursements` | "What claims require my attention before payment?" |
| **Payments** | `/payments` | "Who needs to be paid, what is blocking them, what is already paid?" |

**Invoices & A/R** is a **first-class business record**, not a third workspace.
It is reachable by direct URL (`/invoices`, `/invoices/[id]`) and is expressed as
the second facet of the *Claims & Billing* workspace via the shared
`WorkspaceSegments` component. This preserves every existing deep link while
framing "Bill claims" and "Invoices & A/R" as one workspace with two facets.

Routes are unchanged; no deep links break. The sidebar shows two financial
destinations: **Claims & Billing** and **Payments**.

The canonical workflow (frozen, unchanged):

```
approved → invoiced (draft → issued → paid) → to_be_paid → paid
```

Human translation of technical states:

| Technical | Human |
|---|---|
| `approved` (unbilled) | Ready for billing |
| `issued` invoice | Awaiting organization payment |
| `paid` invoice | Ready for clinic payout |
| `to_be_paid` claim | Ready to pay |
| `paid` claim | Paid |

---

## 3. Visual Design System

- **Foundation:** Tailwind CSS 4 (`@theme` in `globals.css`, no
  `tailwind.config.js`). No new CSS framework, no `components/ui/` shadcn
  scaffold introduced.
- **Color tokens:** semantic only — `neutral / info / success / warning / danger`.
  The legacy `purple` and `amber` summary-card tones were removed. `paid` is a
  **success** state (emerald), never a highlight color.
- **Typography:** existing `--font-satoshi` (body) + `--font-roca` (headings).
  Financial figures use `tabular-nums` and monospace for IDs/references.
- **Icons:** `lucide-react` only (already installed). No emoji, no decorative
  icons. Icons appear where they add meaning (bank, receipt, wallet, warning).
- **Radius / borders / shadow:** a consistent `rounded-xl` for cards,
  `rounded-lg` for controls, `rounded-full` for pills. Borders are `border-gray-200`
  on white; shadows are a single elevated `shadow-lg` on the sticky selection
  toolbar only. No floating/shadow-card aesthetic.
- **Elevation:** one sticky selection toolbar (`bg-gray-900`) is the only
  deliberately elevated surface, used for a transient bulk-action context.

---

## 4. Status System

**One shared mapping** lives in `src/lib/financial/status.ts`:

- `CLAIM_STATUS_DISPLAY` / `INVOICE_STATUS_DISPLAY` — human-facing labels.
- `CLAIM_STATUS_TONE` / `INVOICE_STATUS_TONE` — semantic tone keys.
- `StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'`.

| Claim | Tone | Invoice | Tone |
|---|---|---|---|
| pending | neutral | draft | neutral |
| in_progress | info | issued | warning |
| approved | info | paid | success |
| to_be_paid | warning | archived | neutral |
| rejected | danger | | |
| frozen | info | | |
| paid | success | | |

The shared `FinancialStatusBadge` component renders label + tone with a status
dot. There is no purple anywhere in the status vocabulary (a unit test asserts
this). Legacy `CLAIM_STATUS_COLOR` / `INVOICE_STATUS_COLOR` maps were deleted
from the list pages; the detail pages now use the shared badge + display/tone
maps.

---

## 5. Financial Number Formatting

`formatCurrency` in `src/lib/financial/format.ts` now produces
**two decimals with thousands separators** via `toLocaleString`:

```
OMR 12,450.00   (not OMR 12450.000)
```

`toLocaleString` also avoids the float noise of `toFixed` (e.g. `0.1 + 0.2`
renders "0.30", not "0.30000000000000004"). Amounts are right-aligned in
tables with `tabular-nums`. CSV exports (payout/history) intentionally keep
`toFixed(3)` precision for accounting export — that is data, not display.

---

## 6. Claims & Billing Workspace

Route `/reimbursements`.

- Header title **"Claims & Billing"**; subtitle reframes to the full
  bill-to-payout arc.
- `WorkflowStepper` + `WorkspaceSegments active="billing"` render at the top,
  so the operator reads "Bill claims / Invoices & A/R" as one workspace.
- Organization selector is the billing starting point (billing happens one
  organization at a time).
- The ready-banner now reads **"Ready for billing"** / **"Nothing ready to bill"**,
  with the org-scoped eligible count + total.
- Claim table uses `FinancialStatusBadge` for the claim status and
  `BillingEligibilityBadge` for the billing column (claim→invoice traceability
  without inventing a fake claim status). "Invoice history" action is renamed
  **"Invoices & A/R"**.
- Selection is a persistent shortlist with a sticky `bg-gray-900` toolbar
  (count + total + "Generate Invoice (n)" + Clear).

---

## 7. Payments Workspace

Route `/payments`.

- Header title simplified to **"Payments"** (was "Payment Operations").
- KPI row via `FinancialSummaryCards`: Ready to Pay (success), Blocked (warning),
  Paid Today (neutral), Outstanding (info). The Paid Today card lost its purple.
- Three views — **Ready to Pay · Blocked · Paid (History)** — remain the
  actionable unit = the claim; organization and clinic are context, filters,
  grouping. The "Paid (History)" tab tone moved from purple to slate.
- Group-by-clinic toggle, search, organization filter, CSV export, and the
  `PaymentRecordDialog` (context-before-confirmation) are unchanged — they were
  already correct and are reused, not redesigned.

---

## 8. Invoices & A/R (first-class record)

Route `/invoices` (and `/invoices/[id]`).

- Header title **"Invoices & A/R"**; subtitle reframes to issue + collect + A/R.
- `WorkspaceSegments active="invoices"` frames it as the second facet of
  Claims & Billing. The internal `Invoices` / `A/R Ledger` toggle remains as the
  record-level sub-view.
- Invoice status now renders through `FinancialStatusBadge` +
  `INVOICE_STATUS_DISPLAY` + `INVOICE_STATUS_TONE` ("Draft", "Awaiting
  organization payment", "Paid", "Archived"). The detail page (`/invoices/[id]`)
  uses the same shared badge.

---

## 9. Components Created / Reused

**Created this phase:**

- `src/components/financial/FinancialStatusBadge.tsx` — shared status pill
  (label + tone + dot). Single source of truth for status color.
- `src/components/financial/WorkspaceSegments.tsx` — the "Bill claims /
  Invoices & A/R" tablist that fuses the two facets into one workspace.

**Reused (unchanged):** `WorkflowStepper`, `FinancialWorkflowHeader`,
`FinancialSummaryCards`, `FinancialNextAction`, `FinancialExceptionBanner`,
`FinancialEmptyState`, `FinancialSkeleton` (table + summary),
`BillingEligibilityBadge`, `FinancialRecordLink`, `ConfirmActionDialog`,
`SuccessBanner`, `GenerateInvoiceDialog`, `PaymentRecordDialog`,
`PrintableInvoice`, `PrintablePayment`, `PrintableClaimReceipt`,
`ClaimTimeline`, `FinancialTimeline`.

---

## 10. Selection & Bulk Operations

- Claims: checkbox column selects eligible claims into a **persistent
  shortlist** (survives filter/page changes; reset only on organization switch,
  which is an explicit context change). "Select all" acts on the page's
  *eligible* claims, not every row, with a clear `aria-label`.
- Payments: per-claim "Record" plus a bulk "Record N Payments" that feeds the
  cohort into `PaymentRecordDialog`. Duplicate claimIds are rejected server-side
  by the ledger's unique index.
- The selection toolbar is the only elevated (`sticky`, `bg-gray-900`) surface.

---

## 11. Filters & Search

- Filters are a single compact row of labeled controls (search, status, date
  range, sort, order). Search is debounced by the existing fetch-on-change
  pattern with `skip` reset. No removable-chip UI was introduced because the
  current filters are bounded and labeled — adding chips would be decorative.
- Payments search covers employee, claim, invoice, clinic, and organization in
  one box.

---

## 12. Empty / Loading / Error States

- **Empty:** `FinancialEmptyState` answers *what / why / what-next* (e.g.
  "No claims ready to pay — claims become ready when an approved claim enters
  the queue with complete bank details. Missing bank details land in Blocked.").
- **Loading:** skeletons (`FinancialTableSkeleton`, `FinancialSummarySkeleton`),
  never full-page spinners, reserving layout space to avoid CLS.
- **Error:** `FinancialExceptionBanner` is actionable and dismissible, with the
  recovery path stated.

---

## 13. Detail Drawers & Pages

The financial detail pages are full routes (not drawers) — `/invoices/[id]`,
`/payments/[claimId]`, `/reimbursements/[id]`. They are consistent: an eyebrow,
a monospace reference heading, a status badge, actions (print/export),
and a printable document component for the official artifact. De-purpling was
applied here too (see §19 for what remains out of scope).

---

## 14. PaymentRecord Dialog

`PaymentRecordDialog` (reused) is the context-before-confirmation modal for
recording payouts. It groups the payout cohort, shows the total, lists the
claim/invoice/bank context, and preserves `claimId / invoiceId / bankReference /
notes / paymentDate / method`. No bypass of `PaymentRecord` was introduced.

---

## 15. Responsive Design

- List pages use `max-w-7xl` with responsive padding; tables wrap in
  `overflow-x-auto` and collapse non-essential columns at `md` / `lg` breakpoints.
- Amounts stay right-aligned and readable at narrow widths; filters wrap.
- No fixed pixel container widths, no horizontal page scroll.

---

## 16. Animation & Motion

- Subtle `transition-colors` (150–250ms) on interactive controls; `animate-spin`
  only on active refresh/loading indicators.
- No new animation library was introduced. Framer Motion/Motion was **not**
  installed (correctly — it isn't available and isn't needed). The existing
  `tailwindcss-animate` utilities are the ceiling.
- Respects reduced-motion by using no decorative motion at all; state changes
  are color/fill transitions, not movement.

---

## 17. Accessibility

- Status conveyed by **color + text label + icon/dot**, never color alone.
- Icon-only buttons carry `title` or `aria-label`; the "select all" checkbox has
  an `aria-label`.
- `WorkspaceSegments` and the Payments `TabBar` use `role="tablist"` /
  `role="tab"` / `aria-selected`.
- Links are real `<Link>`/`<a>` with meaningful text; deep links preserved.
- Contrast: body text is gray-900/700 on white or gray-50; accent text on
  colored pills uses the darker shade of the tone (e.g. `text-emerald-800` on
  `bg-emerald-100`). The gray-on-colored-background anti-pattern was avoided.

---

## 18. Performance & React Architecture

- No 1000-line monoliths: presentational pieces are module-level helpers within
  the payments page (already true); pure logic lives in `src/lib/financial/*`
  (framework-free, unit-tested). Data fetching is `useCallback`-memoized and
  filtered/grouped via `useMemo`.
- No new dependencies, no new frameworks. Bundle footprint unchanged.

---

## 19. Deferred Work

Explicitly out of scope for this phase (per the directive):

- **Dashboard (`/`) and non-financial purple:** the dashboard hero icon uses a
  purple→violet gradient, and tenant/logs/scanner/attribute-template surfaces
  use purple accents. These are outside the financial workspace and were left
  untouched to avoid scope creep. They should be de-purpled in a separate,
  dedicated pass.
- **Removable filter chips / debounce abstraction:** current filters are bounded
  and labeled; chip UI was judged decorative, not functional.
- **Right-side detail drawer** replacing full detail routes.
- **Caching, global dead-code cleanup, backend redesign, Chat / Requests /
  Notifications / tenant UI.**
- **`to_be_paid` orange→amber and `frozen` sky→info normalization** in the
  claim-detail `STATUS_CONFIG` and `ClaimTimeline`: orange/sky are warning/info
  variants and were left to keep this pass focused on purple removal; a future
  pass can unify them onto the four semantic tones exactly.

---

## Appendix — Design Validation Checklist

1. No purple gradients / cyan-on-dark / neon / glassmorphism / AI-dashboard — **PASS** (financial surface).
2. One primary accent only — **PASS** (`--primary` green).
3. Semantic color reserved for meaning — **PASS** (success/warning/error/info/neutral).
4. Two primary workspaces, routes preserved — **PASS** (Claims & Billing, Payments; `/invoices` intact).
5. Technical states translated to human language — **PASS** (display maps).
6. One shared status mapping — **PASS** (`status.ts` + `FinancialStatusBadge`).
7. One shared currency formatter with separators — **PASS** (`formatCurrency`).
8. Tabular/right-aligned amounts — **PASS**.
9. Lucide icons only, no emoji/decorative icons — **PASS**.
10. No new component framework / animation library — **PASS**.
11. Subtle 150–250ms transitions, reduced-motion safe — **PASS**.
12. Empty/loading/error states answer what/why/what-next — **PASS**.
13. Accessibility: color+text+icon, labels on icon-only controls — **PASS**.
14. Responsive: overflow-x tables, no horizontal page scroll — **PASS**.
15. Verified business logic untouched — **PASS** (`tsc --noEmit` clean, 59 tests pass).
