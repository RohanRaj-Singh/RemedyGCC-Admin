# Super Admin Dashboard Redesign — 2026-08-27

**Phase 9 — Information-First Operational Command Center**

## 1. Product Objective

Replace the previous generic dashboard (decorative KPI cards, two stacked "Recent" lists, a logs table, and a branding breakdown) with an information-first operational command center. The dashboard is now the front door of the financial operations console — orientation, attention, action.

Within 10 seconds the Super Admin must be able to answer:

1. What is happening right now?
2. What needs my attention?
3. What is blocked?
4. What financial work is waiting?
5. What changed recently?
6. Are there any problems?
7. What should I do next?
8. Where do I go to resolve it?

The bar is the feel of Stripe / Linear / Ramp — calm, dense, numbers-forward, low-decoration, premium SaaS.

Hard constraints (verbatim, locked):

- **Only the dashboard at `/` was redesigned.** No edits to Claims & Billing, Payments, Invoices, Tenant UI, scanner module, attribute templates, or any backend route (other than the single new aggregate endpoint).
- **No invented business metrics.** Every dashboard metric maps to a real data point.
- **No application-wide caching.**
- **No broad code cleanup.**
- **No requests/chat/notifications implementation.**
- **No purple gradients, no cyan neon, no AI-dashboard aesthetics.**

## 2. Information Model

Every metric is real, sourceable, and actionable. No invented counters.

| # | Metric | Source | Meaning | Action / Destination |
|---|--------|--------|---------|----------------------|
| M1 | Claims ready for billing | reimbursements `status=approved` filtered by `!invoiceId` | Approved claims that can join an invoice | `/reimbursements?status=approved` |
| M2 | Invoices awaiting organization payment | invoices `status=issued` | Money Remedy is owed (A/R exposure) | `/invoices?status=issued` |
| M3 | Claims ready for payout (with complete bank) | reimbursements `status=to_be_paid` filtered by bank completeness | Claims that can actually be paid | `/payments` |
| M4 | Blocked payouts | `to_be_paid` claims missing `bankAccountNumber` or `bankName` (Phase-6 `missing_bank` reason) | Operational exception | `/payments?tab=blocked` |
| M6 | Outstanding invoice value (OMR) | sum of `totalAmount` for `issued` invoices | A/R in OMR | `/invoices?status=issued` |
| M7 | Paid this period (OMR) | sum of `totalAmount` for `paid` invoices with `paidAt` in current month | Reconciliation velocity | `/invoices?status=paid` |
| M8 | Active organizations | existing `/api/super-admin/tenants/stats` (active count) | Customer footprint | `/tenants` |
| M9 | Active clinics | existing `/api/super-admin/clinics` (length of returned list) | Recipient base | `/clinics` |
| M10 | Active employees | existing `/api/super-admin/employees` (length of returned list) | Submitter base | `/employees` |
| M11 | Unread notifications (Super Admin) | `/api/super-admin/notifications/unread-count` | Operator attention | `/notifications` |

**Explicitly excluded (card-wall traps avoided):**

- "Total claims ever" — not actionable.
- "Active runtime configs" — irrelevant to operations.
- "Branding breakdown" — decorative.
- "Total submissions" — vanity metric.
- "Recent Tenants", "Recent Logs", "Scanner Status" panels — moved to their respective workspaces, not the dashboard.
- Decorative charts / donuts / pies / line graphs.
- 14-day "overdue" aging metric — the previous audit explicitly removed this since no SLA exists. Re-introducing it would violate the constraint.

## 3. Information Hierarchy

Top → bottom visual priority:

1. **Header** — orientation (greeting, date, one-sentence context).
2. **NEXT UP** — single primary action banner (most prominent after the header).
3. **ATTENTION** — list of attention items (blockers, awaiting, ready).
4. **WORKFLOW** — the 5-stage pipeline (clickable stages).
5. **RECENT FINANCIAL ACTIVITY** — typed feed of recent events.
6. **OPERATIONAL CONTEXT** — compact counts (organizations, clinics, employees, notifications).

No card wall. One strong summary region, one attention region, one workflow region, one activity region, supporting context.

## 4. Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header                                                              │
│   Good morning, Admin · Wed, Aug 27, 2026                          │
│   8 claims ready to bill · 4 invoices awaiting payment · …         │
├─────────────────────────────────────────────────────────────────────┤
│ NEXT UP (state-dependent, single primary action)                    │
│   "8 approved claims are ready for billing.   [Take action →]"      │
│   (ladder: blocked → readyToBill → awaitingOrgPayment → readyToPay) │
├─────────────────────────────────────────────────────────────────────┤
│ ATTENTION (full width, semantic)                                    │
│   • 3 payouts blocked — bank details missing                       │
│   • 4 invoices awaiting organization payment                       │
│   or "All financial operations are up to date."                    │
├─────────────────────────────────────────────────────────────────────┤
│ WORKFLOW (5-stage clickable pipeline)                               │
│   Ready for billing  ·  Awaiting org payment  ·  Ready to pay  ·   │
│   Blocked            ·  Paid (this month)                           │
├─────────────────────────────────────────────────────────────────────┤
│ RECENT FINANCIAL ACTIVITY (typed feed)                              │
│   Icon · Verb · Reference · Counterparty · Amount · Relative time  │
├─────────────────────────────────────────────────────────────────────┤
│ OPERATIONAL CONTEXT (two-up)                                        │
│   System: Organizations / Clinics / Employees                      │
│   Communication: Unread notifications                              │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. Data Sources — All Already Present

All data is fetched through existing authenticated routes under `/api/super-admin/**` (proxied to Tenant App via `TENANT_APP_URL` + `ADMIN_API_KEY`). **No new backend endpoints except the single aggregate endpoint.**

Single new endpoint: **`GET /api/super-admin/dashboard/summary`**.

This endpoint composes the following upstream calls in `Promise.all` server-side, with a 10-second per-call `AbortSignal.timeout`:

- `GET /api/super-admin/reimbursements?status=approved&limit=500` — for `readyForBilling`.
- `GET /api/super-admin/reimbursements?status=to_be_paid&limit=500` — for `readyToPay` and `blocked`.
- `GET /api/super-admin/invoices?status=issued&limit=500` — for `awaitingOrgPayment` + invoices-over-7-days (informational only).
- `GET /api/super-admin/invoices?status=paid&limit=500` — for `paidThisMonth`.
- `GET /api/super-admin/tenants/stats` — for `organizationsActive`.
- `GET /api/super-admin/clinics?limit=1` — list length for `clinicsActive`.
- `GET /api/super-admin/employees?limit=1` — list length for `employeesActive`.
- `GET /api/super-admin/notifications/unread-count` — for `notificationsUnread`.

Each upstream call is wrapped in `safeFetchJson`. Per-call failures are silently swallowed and surfaced as zero counts / empty recent — the response always returns 200 with a typed `DashboardSummary` payload. This replaces 8 client round-trips with 1.

No persistence. No caching. Computed on demand.

## 6. Component Architecture

New files under `src/components/dashboard/`. The page is a thin orchestrator; sections own their own skeleton + error + empty state.

```
src/app/page.tsx                                (chrome + <DashboardView/>)
src/components/dashboard/
  DashboardView.tsx                             (top-level layout)
  DashboardHeader.tsx                           (greeting + date + context line)
  NextUpBanner.tsx                              (state-dependent primary action)
  AttentionCenter.tsx                           (blockers + invoice follow-up + all-clear)
  WorkflowPipeline.tsx                          (5-stage clickable pipeline)
  WorkflowStageRow.tsx                          (single stage row)
  RecentFinancialActivity.tsx                   (typed feed of recent events)
  ActivityRow.tsx                               (single activity row)
  OperationalContext.tsx                        (orgs/clinics/employees/notifications)
  ContextStat.tsx                               (single context stat)
  DashboardSkeleton.tsx                         (per-section loading placeholders)
  DashboardError.tsx                            (full-page error with retry)
  index.ts                                      (barrel export)
src/lib/dashboard/
  types.ts                                      (DashboardSummary TS shape)
  relativeTime.ts                               (Intl.RelativeTimeFormat helper)
src/app/api/super-admin/dashboard/summary/route.ts   (single aggregate endpoint)
src/hooks/useDashboardSummary.ts                (single fetch hook)
src/hooks/index.ts                              (re-export)
```

The non-financial surfaces (Tenants, Scanners, Logs, Attribute Templates, Settings) are reachable via the Sidebar as standalone routes — they were already standalone (`/tenants`, `/scanners`, `/logs`, `/attribute-templates`, `/settings`), each with its own `layout.tsx` that renders Sidebar. The previous in-page tab state machine in `page.tsx` is removed.

## 7. Section Designs

### 7.1 Header (compact, no hero)

- One line: `Good morning, Admin · Wed, Aug 27, 2026`. Time-of-day aware.
- Sub-line: short contextual sentence composed from the summary (`8 claims ready to bill · 4 invoices awaiting payment · 3 payouts blocked`). If all counts are zero: `All financial operations are up to date.`
- No gradient. No avatar card. No big clock.

### 7.2 NEXT UP (state-dependent single banner)

Computed deterministically using a fixed priority ladder:

1. If `blocked > 0` → "3 payouts are blocked — bank details are missing." → `/payments?tab=blocked` (danger tone).
2. Else if `readyForBilling > 0` → "8 approved claims are ready for billing." → `/reimbursements?status=approved` (info tone).
3. Else if `awaitingOrgPayment > 0` → "4 invoices awaiting organization payment." → `/invoices?status=issued` (info tone).
4. Else if `readyToPay > 0` → "5 claims ready for payout." → `/payments` (info tone).
5. Else → "All financial operations are up to date." (success tone, no button).

State-dependent, not invented. Mirrors the Phase-7 `FinancialNextAction` pattern but elevated to page level.

### 7.3 ATTENTION (semantic, never alarmist)

A list of attention items, each rendered as `icon · label · amount · →`:

- **Payouts blocked — bank details missing** — uses the `warning` tone.
- **Invoices awaiting organization payment** — uses the `info` tone.
- **Approved claims ready to bill** — uses the `info` tone.

If all three are empty: an "All clear" panel (success tone).

### 7.4 WORKFLOW PIPELINE (the 5-stage pipeline)

Five clickable rows, each `dot · label · description · count · amount · chevron`:

| Stage | Source | Tone |
|-------|--------|------|
| Ready for billing | approved AND no invoice | neutral |
| Awaiting organization payment | issued invoices | info |
| Ready to pay | `to_be_paid` with complete bank | neutral |
| Blocked | `to_be_paid` missing bank | warning |
| Paid (this month) | paid + `paidAt` in current month | success |

Each row is a `<Link>` to the matching workspace + filter.

### 7.5 RECENT FINANCIAL ACTIVITY (typed feed)

A single typed feed combining recent items, sorted desc by timestamp:

| Type | Reference | Counterparty | Amount | When |
|------|-----------|--------------|--------|------|
| `invoice_issued` | INV-1042 | ABC Organization | OMR 1,240.00 | 12 min ago |
| `invoice_paid` | INV-1038 | XYZ Org | OMR 4,820.00 | 1 h ago |
| `payment_recorded` | PAY-1021 | Clinic ABC | OMR 540.00 | today |
| `claim_ready` | CLM-2048 | John Doe | OMR 180.00 | 32 min ago |

Each row is a `<Link>` to its detail page. Empty state: `No recent activity in the last 24 hours.`

### 7.6 OPERATIONAL CONTEXT (compact two-up)

Two small panels side-by-side at desktop, stacked on mobile:

- **System** — Active organizations · Active clinics · Active employees (each links to its workspace).
- **Communication** — Unread notifications (hidden entirely when zero).

Counts only — no detail in the dashboard. The destination workspace is the source of truth.

## 8. Visual System (extending Phase 7, not contradicting)

All rules from `super-admin-financial-workspace-redesign-2026-08-26.md` carry over unchanged:

- Neutral foundation (`bg-gray-50` page, white surfaces, `border-gray-200`).
- One primary accent: brand green (`--primary`).
- Semantic tones only — `success / warning / danger / info / neutral`.
- No purple gradients. No cyan neon. No glassmorphism. No animated counters. No decorative icons.
- `lucide-react` only. Icons carry meaning.
- Typography: existing Satoshi body / Roca headings. `tabular-nums` for amounts.
- Radius: `rounded-xl` cards, `rounded-lg` controls.
- Subtle motion only (`transition-colors` 150–250ms). Respects `prefers-reduced-motion`.

Dashboard-specific:

- No hero. No purple→violet gradient.
- No `StatsCard` icon-color gradients (cyan→blue, green→emerald, purple→violet, amber→orange) — all removed.
- No "decorative top-right illustration" in KPI cards.
- Workflow pipeline rows are full-width link rows, not cards.
- Attention rows are compact rows, not cards.

## 9. State Behavior

### 9.1 Loading

Per-section skeletons (`DashboardSkeleton`). Header renders immediately. Sections reveal independently as soon as the single `summary` response lands.

### 9.2 Empty states (compose with what is true)

- **All clear:** "All financial operations are up to date. There are no outstanding issues requiring attention."
- **No recent activity:** "No recent activity in the last 24 hours."
- **No unread notifications:** the Communication panel shows "No unread notifications." instead of zero with a `warning` tone.

Empty states explain *what* and *why*, never "No data".

### 9.3 Error states

The dashboard makes a single network call. If that call fails entirely, the page renders `DashboardError` (full-page) with a Retry button that calls `refresh()`.

If the response is partial (some upstream calls failed), the page renders with zero counts / empty recent — the response always returns 200, so this is a graceful degradation, not an error UI.

## 10. Interaction Model

Every actionable item has a destination. No decorative metrics.

| Click | Destination |
|-------|-------------|
| NEXT UP banner | relevant workspace |
| Bank details required | `/payments?tab=blocked` |
| Invoices awaiting payment | `/invoices?status=issued` |
| Ready to bill | `/reimbursements?status=approved` |
| Workflow stage row | `/<workspace>?filter=<stage>` |
| Recent activity row | claim / invoice / payment detail page |
| Org / clinic / employee count | `/tenants`, `/clinics`, `/employees` |
| Unread notifications | `/notifications` |
| Refresh button (top-right) | re-runs the summary fetch |

Workspace filters use the existing `?status=` and `?tab=` conventions — no new filter UI.

## 11. Responsive

- Desktop (≥1024px): workflow full-width rows; context panels side-by-side; recent activity shows all columns.
- Tablet (≥768px): stacks to single column. Tables wrap in `overflow-x-auto`.
- Mobile (`<768px`): single column. Recent activity hides counterparty column (`hidden sm:block`); primary CTA always visible.
- No fixed pixel widths. No horizontal page scroll.

## 12. Performance

- **One server round-trip** (`GET /api/super-admin/dashboard/summary`) instead of 8 client round-trips.
- `useDashboardSummary` does NOT poll. Re-fetch on user-driven `refresh()` only.
- No new client caching. No SWR / React Query. The existing `useState + useEffect` pattern carries over.
- Per-section skeletons reserve layout to avoid CLS.
- `Intl.RelativeTimeFormat` for "12 min ago" — no new dependency.

## 13. React Architecture

`DashboardPage` (in `page.tsx`) is the thin auth-gated shell that renders the chrome (`Header` + `Sidebar`) and the `<DashboardView />` component. `DashboardView` is a self-contained client component holding the summary hook. Each section is a self-contained component receiving typed props.

```
DashboardView
├── DashboardHeader                (synchronous, renders immediately)
├── NextUpBanner                   (skeleton or content)
├── AttentionCenter                (skeleton or content)
├── WorkflowPipeline               (skeleton or content)
├── RecentFinancialActivity        (skeleton or content)
└── OperationalContext             (skeleton or content)
```

## 14. Accessibility

- All status conveyed by **color + text + icon** (matches Phase 7 rule).
- All clickable rows are real `<Link>` elements with clear text.
- `aria-live="polite"` on the NEXT UP banner so screen readers hear state changes after refresh.
- Color contrast: text on white ≥ WCAG AA. Semantic pills use the darker tone-on-tone pair.
- Heading order: one `h1` (header greeting), `h2` for each section.
- Reduced-motion respected.

## 15. Files Changed

**New:**

- `src/components/dashboard/DashboardView.tsx`
- `src/components/dashboard/DashboardHeader.tsx`
- `src/components/dashboard/NextUpBanner.tsx`
- `src/components/dashboard/AttentionCenter.tsx`
- `src/components/dashboard/WorkflowPipeline.tsx`
- `src/components/dashboard/WorkflowStageRow.tsx`
- `src/components/dashboard/RecentFinancialActivity.tsx`
- `src/components/dashboard/ActivityRow.tsx`
- `src/components/dashboard/OperationalContext.tsx`
- `src/components/dashboard/ContextStat.tsx`
- `src/components/dashboard/DashboardSkeleton.tsx`
- `src/components/dashboard/DashboardError.tsx`
- `src/components/dashboard/index.ts`
- `src/lib/dashboard/types.ts`
- `src/lib/dashboard/relativeTime.ts`
- `src/app/api/super-admin/dashboard/summary/route.ts`
- `docs/design/super-admin-dashboard-redesign-2026-08-27.md` (this file)

**Modified:**

- `src/app/page.tsx` — stripped to a thin auth-gated shell that renders chrome + `<DashboardView />`. The 6-tab `useState<TabType>` state machine is gone. The decorative `StatsCard` gradients and `Recent Tenants` / `Scanner Status` / `Recent System Logs` / `Branding Overview` panels are gone.
- `src/hooks/index.ts` — re-exports `useDashboardSummary`.

**Untouched:**

- `src/app/reimbursements/**`, `src/app/payments/**`, `src/app/invoices/**`.
- `src/components/financial/**`.
- `src/lib/financial/**`.
- All other API routes.
- The `/tenants`, `/scanners`, `/logs`, `/attribute-templates`, `/settings` routes (still reachable via Sidebar, already standalone with their own layouts).
- Tenant portal, tenant-auth, scanner, attribute-template modules.

## 16. Single New Aggregate Endpoint — `GET /api/super-admin/dashboard/summary`

Response shape (strict TS):

```ts
type DashboardSummary = {
  generatedAt: string; // ISO
  workflow: {
    readyForBilling:    { count: number; amount: number };
    awaitingOrgPayment: { count: number; amount: number };
    readyToPay:         { count: number; amount: number };
    blocked:            { count: number; amount: number };
    paidThisMonth:      { count: number; amount: number };
  };
  attention: {
    blockedByBank:     { count: number; amount: number };
    invoicesOver7Days: { count: number; amount: number }; // informational only
  };
  recent: Array<
    | { kind: 'invoice_issued';   id: string; number: string; tenantName: string;   amount: number; at: string }
    | { kind: 'invoice_paid';     id: string; number: string; tenantName: string;   amount: number; at: string }
    | { kind: 'payment_recorded'; id: string; claimId: string; clinicName: string;  amount: number; at: string }
    | { kind: 'claim_ready';      id: string; claimNumber: string; employeeName: string; amount: number; at: string }
  >; // newest first, max 12 items
  context: {
    organizationsActive: number;
    clinicsActive: number;
    employeesActive: number;
    notificationsUnread: number;
  };
};
```

Implementation:

- Auth-gated via `requireApiAuth(request)`.
- All upstream calls run in `Promise.all` with `AbortSignal.timeout(10_000)` each.
- Composes from existing proxied endpoints (reimbursements, invoices, tenants/stats, clinics, employees, notifications/unread-count).
- No persistence. No caching. Computed on demand.
- All upstreams are wrapped in `safeFetchJson`. Per-call failures silently degrade to zero counts / empty recent — the response always returns 200 with the typed payload.

This is **composing existing data**, not a new backend service.

## 17. Existing Code to Reuse (do not reinvent)

- `src/lib/financial/status.ts` — `StatusTone` type for semantic coloring.
- `src/lib/financial/format.ts` — `formatCurrency`.
- `src/components/layout/Sidebar.tsx` + `Header.tsx` — chrome unchanged.

## 18. Anti-Patterns Explicitly Avoided

- Purple gradients, cyan neon, glassmorphism, AI-dashboard aesthetics.
- Card walls (`[Card][Card][Card][Card]`).
- Decorative charts / donuts / pies / line graphs.
- Rainbow KPI cards with neon gradients.
- Invented SLAs (no 14-day "overdue" aging rule).
- Emoji as icons.
- Full-page spinner on load.
- Multiple icon libraries.
- Application-wide caching.
- Polling.
- Re-skinning the rest of the sidebar / other tabs.

## 19. Verification

After implementation:

1. **Type check:** `npx tsc --noEmit` — passes clean.
2. **Tests:** `npm test` — 59/59 pass. The financial unit tests (`src/lib/financial/tests/**`) and tenant-auth tests (`src/modules/tenant-auth/tests/**`) are unchanged and continue to pass.
3. **Visual smoke:** confirmed by walking each section in code:
   - NEXT UP banner reacts to state via the fixed priority ladder.
   - ATTENTION rows render only when counts > 0; "All clear" renders otherwise.
   - WORKFLOW PIPELINE rows are clickable and route to existing workspaces with `?status=` / `?tab=` filters.
   - RECENT activity merges the four event kinds and sorts desc by timestamp.
   - Skeletons appear on first load per section.
   - Per-section errors surface via the `safeFetchJson` graceful degradation (zero counts / empty recent).
4. **No fabricated metrics:** every metric on the dashboard maps to a real data point in `DashboardSummary`. The Information Model table (§2) is complete.
5. **Hard scope:** diff confirms no edits under `src/app/reimbursements`, `src/app/payments`, `src/app/invoices`, `src/components/financial`, `src/lib/financial`, or any other backend route other than the single new `dashboard/summary/route.ts`.

## 20. Future Data Requirements (documented, not implemented)

These were considered and explicitly deferred:

1. **Payment SLA / aging buckets** — needs an agreed business rule. Currently the system does not have an SLA. Aging is shown as informational only (over 7 days) without a verdict.
2. **Chart data** — paid-invoice-value trend over 14/30 days. Requires a small aggregation endpoint. Not in v1.
3. **Communication counts** — Requests / Chat unread counts. The dashboard surfaces *Super Admin* notifications only (which exist). Requests / Chat metrics deferred until those modules are wired.
4. **Per-organization drill-down cards** — would require per-tenant aggregated queries. Deferred.
5. **Real-time updates** — would require polling or websockets. Out of scope; user can press Refresh.
