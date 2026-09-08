# Super Admin — Forensic Audit (2026-08-20)

**Scope:** `remedygcc-admin` (Next.js 14 App Router, React 18, TypeScript, Tailwind)
**Audit type:** Performance / Loading UX / UX / Visual / Operational UX / Tests / Dead code / Component factoring / Re-measure / Caching architecture
**Audience:** Engineering lead + product owner
**Status:** Audit + roadmap. **No implementation yet.**

---

## 0. Sacred Invariants

These are **not** to be changed during this audit or its subsequent implementation phases, per the audit brief:

- **Workflow** — approved claim flow, invoice flow, payment flow, tenant responsibilities, Super Admin responsibilities.
- **Permissions** — who can do what in which state.
- **Claim state machine** — `approved → to_be_paid → paid` and adjacent transitions.
- **Financial semantics** — what an invoice is, what a payment is, what "outstanding", "overdue", "received" mean.
- **Boundaries** — Super Admin is the platform operator, tenants manage their own clinics/employees/claims.
- **No silent contradictions** — if a contradiction is found, **report it**, do not silently change it.
- **No caching yet** — Phase G only, after measurement.
- **No destructive cleanup yet** — Phase F only, after deprecation marking.
- **No broad refactors yet** — Phase H factoring, after the audit is approved.

If any of these need to change for technical reasons, raise it as an ADR, not a silent change.

---

## 1. Executive Summary

The Super Admin dashboard **works** — the workflows, permissions, and state machine are correct. But it feels slow, looks visually weak, and behaves inconsistently. The audit identified **114+ concrete findings** across performance, UX, visual design, architecture, and the claims/payments/invoices domain.

### 1.1 Why the dashboard feels slow

1. **Global loading gate on the root dashboard.** `src/app/page.tsx:43-49` blocks the entire UI behind `loading = statsLoading || tenantsLoading || scannersLoading || logsLoading`. The slowest endpoint (often MongoDB-backed tenants or activity logs) gates every card. **Result:** the whole page is empty white for 2–8 seconds before anything renders.
2. **Reimbursements re-fetches on every keystroke.** `src/app/reimbursements/page.tsx:127` — the search input calls `loadReimbursements(filters)` on each change. No debounce.
3. **NotificationBell re-renders the header every 30 s.** `src/components/notifications/NotificationBell.tsx` polls `/api/super-admin/notifications/unread-count` and writes to a context consumed by the header. Every poll = full Header subtree re-render.
4. **Parallel poller overload.** ClaimChat polls every 30 s **and** writes mark-read on every poll. NotificationBell polls every 30 s. Activity logs poll on the dashboard. None of them coalesce.
5. **No caching anywhere.** The proxy layer (`src/app/api/super-admin/*`) re-fetches from the Tenant App on every request. Sidebar tenant counts, payment operations summary, and the invoices ledger are recomputed end-to-end on every navigation.
6. **Server actions vs. route handlers are mixed.** Some mutations go through Server Actions (`'use server'`), others through `/api/...` route handlers. The browser refetches the full page in the route-handler case; only the affected subtree in the server-action case.

### 1.2 Why it looks visually weak

1. **Three different "card" patterns.** `bg-white rounded-2xl border`, `bg-white rounded-xl shadow-sm`, `bg-white rounded-3xl` are mixed throughout. No design system layer.
2. **Mixed icon styles.** `lucide-react` is used, but stroke widths and sizes vary (`h-4 w-4`, `h-5 w-5`, `h-6 w-6`, `h-8 w-8`) without a token system.
3. **Mixed color systems.** Brand teal (`#0f766e / #134e4a`), slate, emerald, red, amber all appear inline with raw hex values. No CSS variables, no Tailwind theme tokens.
4. **Hardcoded inline gradients.** `bg-[linear-gradient(135deg,#0f766e,#134e4a)]` appears in `Sidebar.tsx`, the tenant portal layout, and dashboard cards — duplicated literal.
5. **Status badge colors inconsistent.** Some pages use `bg-emerald-100 text-emerald-700`, others use `bg-green-50 text-green-700`, others use raw RGB.
6. **No typography hierarchy.** Heading sizes are ad-hoc (`text-xl`, `text-2xl`, `text-3xl`) without a scale.
7. **Charts are declared but unused.** `recharts` is in `package.json` but **no `<BarChart>` or `<LineChart>` exists** in the codebase. The dashboard renders numbers in cards instead of trend visualizations.

### 1.3 Biggest UX problems

1. **Bulk-action bar state confusion** (already partially fixed 2026-08-04, monitor-only). Verify regression.
2. **Filter re-fetches on keystroke** with no debounce / pending indicator.
3. **Generate-invoice modal** (`/invoices`) has no preview, no multi-org support, no "what will this create?" confirmation.
4. **Overdue threshold inconsistency** — payments uses 14 d (`OVERDUE_MS = 14 * 86400000`), invoices uses 30 d. Two operators reading two screens get different "overdue" definitions. **This is a domain contradiction — report, do not silently change.**
5. **Empty states are minimal** — mostly "No data" text. No illustration, no CTA, no role-specific guidance.
6. **Error states are absent.** When a fetch fails, the page often silently shows empty data with no banner.
7. **Header search is a stub** (`src/components/layout/Header.tsx`) — `<input>` with no `onChange`, no submit, no results dropdown.
8. **Notification bell** has no badge animation, no grouping, no "mark all read" affordance.
9. **Sidebar collapses to 4 rem width** — labels are hidden but tooltips are not implemented.
10. **Settings page** lives at `/dashboard/settings` (tenant-portal), not in the Super Admin nav. Admins cannot find it.

### 1.4 Biggest architectural problems

1. **Mixed server/client boundaries.** 99 of 108 `.tsx` files are `'use client'`. Even pure presentational components are marked client. This kills RSC streaming benefits.
2. **Three request wrappers.** `src/services/api-client.ts`, `tenant-service.ts`, `clinic-service.ts`, `budget-service.ts` each define their own `request()` instead of importing one shared client.
3. **22 proxy routes reinvent boilerplate.** `src/app/api/_proxy-utils.ts` is **defined but never imported**. Every super-admin proxy route reimplements auth + fetch + error mapping.
4. **`Sidebar.tsx` forces the entire layout tree to client.** Because the sidebar uses `useAuth()` + `usePathname()`, the whole layout under it is a client tree.
5. **`AuthProvider` recreates the value object every render.** `src/context/AuthProvider.tsx` — login/logout are not memoized; every context update re-renders every consumer.
6. **`hooks/useTenants.ts`, `hooks/useLogs.ts`** — `useCallback` dependencies include the `filters` object reference, so they refire on every parent render even when filters haven't changed.
7. **Tenant portal route group co-exists in same Next.js process** as Super Admin (`src/app/(tenant-portal)/layout.tsx`). Middleware does not cover `/reimbursements`, `/payments`, `/invoices`, `/employees` — they are reachable server-side without redirect. Only the API is auth-gated.
8. **MongoDB driver imported in client bundles?** Need to verify — `src/lib/db.ts` if it exists must be server-only.
9. **No test coverage.** `package.json` has no `test` script, no `vitest`/`jest`/`playwright`. **Verify.**

### 1.5 Biggest React / rendering problems

1. **Inline object/array literals in JSX.** `(filters) => setFilters({ ...filters, q: e.target.value })` creates a new object every keystroke → re-renders the entire filter form + every table row.
2. **IIFEs in `.map()` callbacks.** `src/app/reimbursements/page.tsx` computes `paymentStage` and `daysOverdue` inside row JSX with an IIFE — runs on every render.
3. **No `React.memo`** on table rows. A single row update re-renders all N rows.
4. **No `useMemo`** on expensive aggregates (tenant totals, clinic counts, aging buckets).
5. **`page.tsx` global `if(loading)` gate.** See 1.1.1.
6. **`NotificationBell` writes to a context that re-renders the Header on every poll.**
7. **Form state lives in 19 `useState` hooks** in `reimbursements/page.tsx`, 11 in `payments/page.tsx`, 30 in `invoices/page.tsx`. Should be `useReducer` or `useForm`.
8. **`'use client'` at the page level** for what are mostly presentational + fetch-then-render pages. These should be RSC with a small client island for interactivity.
9. **No `Suspense` boundaries** around fetch-heavy sections — entire page waits or nothing renders.
10. **No error boundaries** — a single component crash blanks the whole page.

---

## 2. Performance Score by Category

| # | Category | Rating | Why |
|---|---|---|---|
| 1 | Initial load (LCP) | **Critical** | Root dashboard blank-white for 2–8 s due to global `loading` gate |
| 2 | Time-to-interactive (TTI) | **High** | No Suspense streaming; 99/108 files client; no code splitting by route visible |
| 3 | Render efficiency | **High** | No `memo`/`useMemo`; inline object literals; IIFEs in `.map()` |
| 4 | Data fetching | **Critical** | No debounce; no caching; no SWR/React Query; filter refire on keystroke |
| 5 | Network | **High** | 22 proxy routes hit Tenant App with no `revalidate`; N+1 in payment operations |
| 6 | Tables | **High** | No virtualization; full table re-render on every row update; 906-line invoices page |
| 7 | Bundle size | **Medium** | `recharts` declared but unused — wasted bytes; radix-ui declared but unused |
| 8 | State management | **High** | 30 useState in one component; context value recreated each render |
| 9 | Loading UX | **Critical** | Single binary "loading vs loaded" gate; no skeletons; no per-section async |
| 10 | Error UX | **High** | No error boundaries; failed fetches silently empty |
| 11 | Visual design system | **Critical** | No tokens; mixed card patterns; inline hex; mixed icon sizes |
| 12 | Accessibility | **High** | (Partial — see §6.4) |
| 13 | Responsive | **Medium** | (Partial — see §6.5) |
| 14 | Dead code | **Medium** | `_proxy-utils.ts` unused; `recharts`, `radix-ui` declared but unused; logs API returns `[]` |
| 15 | Component factoring | **High** | 906-line invoices page; 651-line payments page; 613-line reimbursements page |
| 16 | Tests | **Critical** | No test runner, no tests, no coverage |
| 17 | Operational UX (filters/sort/export) | **High** | Search stub; export uses `xlsx`; bulk actions monitor-only |

---

## 3. Problem Registry

> Each finding has: **ID**, category, severity, location, current behavior, evidence, recommended fix, risk, phase. Phases are: **A** Critical Performance, **B** Loading UX, **C** UX Improvements, **D** Visual Modernization, **E** Operational UX, **F** Code Cleanup, **G** Caching Architecture, **H** Component Factoring.

### 3.1 Performance — Data Fetching (SA-PERF-DF)

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-PERF-DF-001 | Critical | `src/app/page.tsx:43-49` | `const loading = statsLoading \|\| tenantsLoading \|\| scannersLoading \|\| logsLoading` gates entire UI | Replace with per-section Suspense or per-section loading state | A |
| SA-PERF-DF-002 | Critical | `src/app/reimbursements/page.tsx:127` | Search input refetches on every keystroke | Debounce 300 ms; or `useDeferredValue` | A |
| SA-PERF-DF-003 | High | `src/hooks/useTenants.ts`, `useLogs.ts` | `useCallback` deps include `filters` ref; refires every parent render | Memoize `filters` with `useMemo`; or use functional setState | A |
| SA-PERF-DF-004 | High | `src/app/api/super-admin/payments/operations` | N+1 query: one Tenant App call per clinic in payout workspace | Batch call or aggregate on server | G |
| SA-PERF-DF-005 | High | All 22 proxy routes | No `revalidate`/`cache: 'no-store'` policy; all hit Tenant App fresh | Add `next: { revalidate: N }` or move to SWR on client | G |
| SA-PERF-DF-006 | Medium | `src/services/tenant-service.ts`, `clinic-service.ts`, `budget-service.ts` | Each redefines own `request()` wrapper | Consolidate on `src/services/api-client.ts` | F |
| SA-PERF-DF-007 | Medium | `src/modules/tenant/service.ts:702` | `buildPublishingPreview` runs even when `includePreview: false` | Guard with `if (includePreview)` | A |

### 3.2 Performance — Rendering (SA-PERF-RN)

> ⚠️ ID-prefix collision with SA-PERF-DF. Renaming for clarity: see prefix `SA-PERF-RN`.

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-PERF-RN-001 | High | `src/app/reimbursements/page.tsx` (rows) | IIFE in `.map()` for `paymentStage`/`daysOverdue` — runs every render | Pre-compute or `useMemo` | A |
| SA-PERF-RN-002 | High | All table pages | No `React.memo` on row components; one row update re-renders all | Extract `<Row>` and `memo()` it | A |
| SA-PERF-RN-003 | High | All list pages | No `useMemo` on aggregates (totals, counts, aging buckets) | `useMemo([data])` | A |
| SA-PERF-RN-004 | High | Filter forms | New object literal on every keystroke → re-renders whole form + table | `useDeferredValue` or local state + commit | A |
| SA-PERF-RN-005 | Medium | `src/context/AuthProvider.tsx` | Value object recreated every render; login/logout not memoized | `useMemo` + `useCallback` | A |
| SA-PERF-RN-006 | Medium | `src/components/notifications/NotificationBell.tsx` | Polls every 30 s; re-renders Header on every tick | Move unread count into a small dedicated island; keep Header pure | A |
| SA-PERF-RN-007 | Medium | `src/components/claims/ClaimChat.tsx` | Polls every 30 s + writes mark-read on every poll | Only write mark-read when panel open; only poll when panel open | A |
| SA-PERF-RN-008 | High | All pages | `'use client'` at page level for what should be RSC | Move fetch to server component; client only for interactivity | H |

### 3.3 Component Architecture (SA-ARCH)

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-ARCH-001 | Critical | `src/components/layout/Sidebar.tsx` | Forces whole layout subtree to client | Split into `<SidebarServer>` (route + role) + `<SidebarClient>` (collapse state) | H |
| SA-ARCH-002 | Critical | `src/components/layout/Header.tsx` | Stub search input — no `onChange`, no results, no submit | Replace with `<CommandPalette>` (cmdk or build-from-scratch) | E |
| SA-ARCH-003 | High | `src/app/invoices/page.tsx` (906 lines) | 30 useState; mixed data fetching + UI + modals | Split into `<InvoicesList>`, `<InvoiceRow>`, `<GenerateInvoiceModal>` | H |
| SA-ARCH-004 | High | `src/app/payments/page.tsx` (651 lines) | 11 useState; aggregate computation inline | Split into `<PaymentsWorkspace>`, `<OrgCard>`, `<ClinicRow>` | H |
| SA-ARCH-005 | High | `src/app/reimbursements/page.tsx` (613 lines, 19 useState) | Filter logic + table + modals in one component | Extract `<Filters>`, `<ClaimTable>`, `<BulkActionBar>` | H |
| SA-ARCH-006 | Medium | `src/app/api/_proxy-utils.ts` | Defined but never imported | Either delete (Phase F) or use (Phase A) | F |
| SA-ARCH-007 | Medium | All API routes | 22 proxy routes reinvent auth + fetch + error mapping | Consolidate on `_proxy-utils.ts` (or equivalent) | A |
| SA-ARCH-008 | Medium | `src/services/*` | Three request wrappers | Consolidate on `api-client.ts` | F |
| SA-ARCH-009 | Medium | `src/components/layout/Sidebar.tsx` | Hardcoded `width/minWidth` 16 rem / 4 rem | Use Tailwind tokens (`w-64`/`w-16`) | D |
| SA-ARCH-010 | Medium | Page-level `'use client'` | 99/108 .tsx files | Audit and push fetch to server, leave only island client | H |

### 3.4 UX / IA (SA-UX)

> **Partial coverage** — dedicated agent failed (429). Findings below are from independent reads.

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-UX-001 | High | `src/app/invoices/page.tsx` (Generate modal) | No preview, no multi-org, no "what will this create?" confirmation | Add preview pane + org selection + create-summary | C |
| SA-UX-002 | High | `src/app/reimbursements/page.tsx` (filters) | Search refires on keystroke (see SA-PERF-DF-002) — but also no "searching…" indicator | Debounce + spinner state | A/C |
| SA-UX-003 | High | `src/app/page.tsx` (loading gate) | Blank-white for 2–8 s on root dashboard | Skeleton per section (see §4) | A/B |
| SA-UX-004 | High | All empty states | "No data" text only — no role-specific guidance, no CTA | EmptyState component with icon + message + action | C |
| SA-UX-005 | High | All error states | No error boundary; failures silently empty | `<ErrorBoundary>` + retry button + toast | C |
| SA-UX-006 | Medium | `src/components/notifications/NotificationBell.tsx` | No badge animation, no grouping, no "mark all read" | Add animation + grouping + action | C |
| SA-UX-007 | Medium | `src/components/layout/Header.tsx` | "Admin User / Super Admin" hardcoded | Use `useAuth().user` | C |
| SA-UX-008 | Medium | All pages | Settings link inconsistent — Super Admin nav lacks it; tenant portal has `/dashboard/settings` | Add `/settings` to Super Admin nav OR route from one place | C |
| SA-UX-009 | Medium | `src/app/(tenant-portal)/layout.tsx` | Tenant portal + Super Admin co-exist; tenants may confuse routes | Add clear route prefix + nav breadcrumb | C |

### 3.5 Visual Design (SA-UI)

> **Partial coverage** — dedicated agent failed (429). Findings from independent reads.

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-UI-001 | Critical | Tailwind config | No design tokens for colors, spacing, type, radius | Add `theme.extend` with semantic tokens (brand, surface, fg, muted, success, warn, danger) | D |
| SA-UI-002 | Critical | Multiple | Inline hex literals (`#0f766e`, `#134e4a`, etc.) scattered | Replace with `bg-brand-600` etc. | D |
| SA-UI-003 | High | `Sidebar.tsx`, tenant-portal layout, dashboard cards | Hardcoded gradient `linear-gradient(135deg,#0f766e,#134e4a)` duplicated 3+ times | Single `<BrandMark>` component | D |
| SA-UI-004 | High | All status badges | Mixed palette (`emerald-100`, `green-50`, raw RGB) | `<StatusBadge variant={...}>` with semantic variants | D |
| SA-UI-005 | High | All icons | Mixed stroke widths and sizes without tokens | `<Icon size="sm|md|lg">` wrapper or token in tailwind | D |
| SA-UI-006 | High | All cards | Mixed border-radius (`rounded-xl`, `rounded-2xl`, `rounded-3xl`) | Token: `rounded-card`, `rounded-tile` | D |
| SA-UI-007 | High | `package.json` + unused | `recharts` declared but **no chart rendered** | Either (a) build dashboard charts (trend lines) or (b) remove | D/F |
| SA-UI-008 | Medium | `package.json` + unused | `@radix-ui/*` declared but **no Radix component imported** | Either (a) replace custom dropdowns/dialogs with Radix or (b) remove | F |
| SA-UI-009 | Medium | All headings | Ad-hoc sizes (`text-xl`/`text-2xl`/`text-3xl`) | Type scale: `text-h1..h6` via Tailwind plugin | D |
| SA-UI-010 | Medium | All pages | No dark mode | Out of scope unless requested | — |

### 3.6 Accessibility (SA-A11Y)

> **Partial coverage** — dedicated agent failed (500). Findings from independent reads.

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-A11Y-001 | High | All interactive elements | Verify focus rings visible | Audit; add `focus-visible:ring-2` consistently | C |
| SA-A11Y-002 | High | All icons-only buttons | Verify `aria-label` | Audit; add labels | C |
| SA-A11Y-003 | High | Tables | Verify `<th scope="col">`, caption, sortable headers have `aria-sort` | Audit + fix | C |
| SA-A11Y-004 | Medium | Modals | Verify focus trap, ESC closes, `aria-modal` | Audit + fix | C |
| SA-A11Y-005 | Medium | Notifications | `aria-live="polite"` for toasts | Audit + fix | C |
| SA-A11Y-006 | Medium | Sidebar collapse | Tooltips missing for collapsed labels | Add `title` + `<Tooltip>` on hover | C |

### 3.7 Responsive (SA-RESP)

> **Partial coverage** — dedicated agent failed (500). Findings from independent reads.

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-RESP-001 | High | Tables | Horizontal scroll on mobile — verify usability | Add card layout below `md:` | C |
| SA-RESP-002 | High | Sidebar | `width: '4rem'` on collapse — icons only on mobile | Verify tap targets ≥ 44 px | C |
| SA-RESP-003 | Medium | Header | Search bar takes too much width on mobile | Collapse to icon, expand on tap | C |
| SA-RESP-004 | Medium | Modals | Verify usable on 360 px width | Audit + responsive variants | C |

### 3.8 Dead Code (SA-CODE)

> **Partial coverage** — dedicated agent failed (500). Findings from independent reads.

| ID | Sev | Location | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-CODE-001 | High | `src/app/api/_proxy-utils.ts` | Defined but never imported | Use it (Phase A) OR mark deprecated (Phase F) | A/F |
| SA-CODE-002 | High | `package.json` | `recharts` declared, never imported | Build charts OR remove | D/F |
| SA-CODE-003 | High | `package.json` | `@radix-ui/*` declared, never imported | Adopt OR remove | D/F |
| SA-CODE-004 | Medium | `src/app/api/super-admin/logs/route.ts` | Returns `[]` stub | Implement OR mark deprecated | F |
| SA-CODE-005 | Medium | All `*.tsx` | Verify no `console.log` left behind | Audit + remove | F |
| SA-CODE-006 | Medium | All services | Verify no unused exports | Lint + remove | F |

### 3.9 Domain — Claims / Payments / Invoices (SA-DOM)

> Coverage: full (38 findings from `ac26fee4d7c5c3de4`).

| ID | Sev | Domain | Issue | Fix | Phase |
|---|---|---|---|---|---|
| SA-DOM-001 | Critical | Invoices | Generate modal: no preview, no multi-org, no "what will this create?" | Add preview + multi-org + summary | C |
| SA-DOM-002 | High | Invoices | OVERDUE threshold = 30 d | **Report only** — flagged for ADR | ADR |
| SA-DOM-003 | High | Payments | OVERDUE threshold = 14 d (`OVERDUE_MS = 14 * 86400000`) | **Report only** — flagged for ADR | ADR |
| SA-DOM-004 | High | Both | **CONTRADICTION:** Invoices says 30 d, Payments says 14 d for the same semantic | **Report** — needs ADR before any change | ADR |
| SA-DOM-005 | High | Reimbursements | Bulk action bar monitor-only — verify regression after 2026-08-04 fix | Verify + add Playwright test | E |
| SA-DOM-006 | High | Invoices | Payment status badge colors inconsistent | `<StatusBadge>` token | D |
| SA-DOM-007 | High | Reimbursements | Filter changes refire fetch on keystroke (see SA-PERF-DF-002) | Debounce | A |
| SA-DOM-008 | High | Payments | N+1 — one Tenant App call per clinic | Batch call | G |
| SA-DOM-009 | Medium | All | Aging buckets computed inline (30/60/90) on every render | `useMemo` | A |
| SA-DOM-010 | Medium | Invoices | `Organization` field not sortable | Make sortable | C |
| SA-DOM-011 | Medium | Reimbursements | Export uses `xlsx` — verify it works for >1k rows | Test + chunked export | E |
| SA-DOM-012 | Medium | Payments | Org totals not updated on date filter change without full refetch | Local aggregate memoization | A |
| SA-DOM-013 | Medium | All | State machine compliance verified for `approved → to_be_paid → paid`; document the audit date | Reference `docs/CLAIM_STATE_MACHINE_AUDIT.md` | — |
| SA-DOM-014 | Low | All | Currency formatting inconsistent (`$1,234.56` vs `$1.2k`) | Single `<Money>` formatter | D |
| SA-DOM-015–038 | … | … | See agent transcript (`ac26fee4d7c5c3de4`) for full domain findings | … | … |

> **⚠️ ADRs required before implementation:**
> - **ADR-DOM-OVERDUE:** align payments/invoices "overdue" semantics. **Report only at this stage.**
> - **ADR-DOM-PREVIEW:** add invoice generate preview without changing what gets generated.
> - **ADR-DOM-BULK:** keep bulk actions monitor-only OR add explicit "submit only" review.

---

## 4. Implementation Roadmap

> **No code changes yet.** Each phase lists the **goal**, **scope**, **acceptance criteria**, and **risk**.

### Phase A — Critical Performance Fixes (1–2 days)

**Goal:** Stop the dashboard from feeling broken.

**Scope:**
- Replace global `if(loading)` gate on root dashboard with per-section Suspense or per-section skeleton (`src/app/page.tsx`).
- Debounce reimbursements search input (300 ms).
- Memoize `filters` in `useTenants` / `useLogs` hooks.
- Fix `buildPublishingPreview` unconditional call (`src/modules/tenant/service.ts:702`).
- Adopt `_proxy-utils.ts` for the 22 proxy routes (consolidate auth + fetch boilerplate).
- Move heavy aggregates into `useMemo`.

**Acceptance:**
- Root dashboard renders header + skeleton within 200 ms; sections fill in independently.
- Reimbursements search triggers ≤ 1 fetch per 300 ms.
- Each table row update renders only that row.

**Risk:** Low — surgical changes.

### Phase B — Loading UX (1 day)

**Goal:** Every async surface has a skeleton, every error has a banner, every empty has a message + CTA.

**Scope:**
- `<Skeleton>` component (already exists in `src/components/ui`? verify).
- `<ErrorBanner>` component.
- `<EmptyState>` component with icon + message + action.
- Wire `<ErrorBoundary>` around table pages.
- Per-section skeletons on root dashboard.

**Acceptance:**
- No "blank white" > 200 ms anywhere.
- Failed fetch shows retry banner within 500 ms.
- Empty state visible with role-specific copy.

**Risk:** Low — additive.

### Phase C — UX Improvements (2–3 days)

**Goal:** Make workflows predictable, findable, and fast to operate.

**Scope:**
- Generate Invoice: preview + multi-org + summary confirmation.
- Header: replace stub search with real command palette.
- Settings: route from one place (likely Super Admin nav).
- NotificationBell: badge animation + grouping + "mark all read".
- Empty states: role-specific copy for each major surface.
- Modals: focus trap, ESC, `aria-modal`.
- Tables: `<th scope>`, `aria-sort`, sticky header.
- Mobile: card layout for tables below `md:`.

**Acceptance:**
- Generate Invoice modal shows preview before commit.
- Header search opens command palette with keyboard shortcut.
- Settings reachable from Super Admin nav.
- Notifications can be marked-all-read in one click.
- All interactive elements keyboard-reachable.

**Risk:** Medium — touches many components.

### Phase D — Visual Modernization (2–3 days)

**Goal:** A consistent, token-driven visual system.

**Scope:**
- Add Tailwind theme tokens: brand, surface, fg, muted, success, warn, danger, info.
- Replace inline hex with `bg-brand-*`, etc.
- Single `<BrandMark>` for the gradient logo.
- `<StatusBadge variant="success|warn|danger|info|neutral">` component.
- `<Icon size="sm|md|lg">` wrapper or stroke/size tokens.
- `rounded-card`, `rounded-tile`, `rounded-pill` radius tokens.
- Type scale: `text-h1..h6` via Tailwind plugin or `@layer`.
- Either build at least one trend chart (recharts) **or** remove `recharts`.

**Acceptance:**
- `grep -r "bg-\[#" src/` returns 0 matches.
- `grep -r "text-\[#" src/` returns 0 matches.
- All status badges use one of N variants.
- All cards use `rounded-card` or `rounded-tile`.

**Risk:** Medium — visual regression possible; needs visual review.

### Phase E — Operational UX (1–2 days)

**Goal:** Bulk actions, exports, filters behave predictably at scale.

**Scope:**
- Verify bulk-action regression (post-2026-08-04 fix).
- Add Playwright test for the bulk-action bar state machine.
- Chunked CSV/XLSX export for >1k rows.
- Filter persistence (URL params).
- Date range picker for invoices/payments.

**Acceptance:**
- Bulk action bar always correct after selection changes.
- Export of 5k rows does not freeze UI.
- Filters survive refresh via URL.

**Risk:** Low–Medium.

### Phase F — Code Cleanup (1 day)

**Goal:** Remove or deprecate dead code. **Mark before delete.**

**Scope:**
- Mark `_proxy-utils.ts` deprecated (after Phase A adoption, remove).
- Decide on `recharts`, `@radix-ui/*`, `xlsx` — adopt or remove.
- Implement or remove the `logs` stub endpoint.
- Audit `console.log`, unused exports, dead branches.
- Run `eslint --fix`, `tsc --noEmit`.

**Acceptance:**
- Lint clean.
- `tsc --noEmit` clean.
- `git grep` for known dead patterns returns 0 matches.

**Risk:** Low if marked before delete.

### Phase G — Caching Architecture (2–3 days)

**Goal:** Stop recomputing the same data on every navigation.

**Scope:**
- Decide between Next.js `fetch` cache, `unstable_cache`, or SWR/React Query on client.
- Apply caching to:
  - Tenant list (TTL 5 min)
  - Invoices ledger (TTL 1 min)
  - Payment operations summary (TTL 1 min)
  - Sidebar tenant counts (TTL 5 min)
- Add cache invalidation hooks for mutations (invoice generated, payment received).
- Add cache hit/miss observability.

**Acceptance:**
- Navigating `/payments` → `/invoices` → `/payments` re-uses cached `/payments` payload.
- Mutation in tenant A invalidates tenant A's cache.
- Cache hit ratio visible in DevTools.

**Risk:** Medium — must invalidate on writes; risks showing stale data.

### Phase H — Component Factoring (2–3 days)

**Goal:** Reduce the largest pages to < 300 lines each.

**Scope:**
- Split `invoices/page.tsx` (906 lines) into `<InvoicesList>`, `<InvoiceRow>`, `<GenerateInvoiceModal>`, hooks.
- Split `payments/page.tsx` (651 lines) into `<PaymentsWorkspace>`, `<OrgCard>`, `<ClinicRow>`.
- Split `reimbursements/page.tsx` (613 lines, 19 useState) into `<Filters>`, `<ClaimTable>`, `<BulkActionBar>`.
- Audit `'use client'` boundaries; push fetch to RSC where possible.
- Extract `<SidebarServer>` / `<SidebarClient>` split.

**Acceptance:**
- Each page file < 300 lines.
- Each major component has a single responsibility.
- `'use client'` count drops from 99 to ~ 40.

**Risk:** Medium — could introduce regression; needs feature-flag or full re-test.

### Phase I — Tests + Re-measure (1–2 days)

**Goal:** Prove fixes work and prevent regression.

**Scope:**
- Install `vitest` + `@testing-library/react`.
- Unit tests for hooks, utilities, state machine.
- Playwright e2e for: login, claim approval, invoice generation, payment receipt.
- Re-measure LCP, TTI, FCP, CLS before/after.
- Lighthouse report baseline + after.

**Acceptance:**
- `npm test` passes.
- E2E covers 4 critical workflows.
- Re-measure report attached.

**Risk:** Low.

---

## 5. Coverage Gaps (Honest)

The audit ran 8 specialist subagents. **4 succeeded, 4 failed** due to API rate limits / server errors:

| Dimension | Agent | Status |
|---|---|---|
| Data fetching | `adcde19bdf53d7ebd` | ✅ 27 findings |
| React rendering | `a30bfab51ad0bc5ca` | ✅ 25 findings |
| Component architecture | `a4ba0be1aac47c251` | ✅ 24 findings |
| Claims/Payments/Invoices domain | `ac26fee4d7c5c3de4` | ✅ 38 findings |
| UX / IA | `af2d622e0c12c89ec` | ❌ 429 rate limit |
| Visual design | `abfea4fc472685f22` | ❌ 429 rate limit |
| A11y / responsive | `ae808940f7eda5d4c` | ❌ 500 server error |
| Dead code | `ac1fc56fbcb623230` | ❌ 500 server error |

For the four failed dimensions, the audit includes **partial coverage** from independent reads of source files. The full audit would re-launch these agents before the implementation phases that depend on them (Phase C for UX, Phase D for visual, Phase C/F for a11y, Phase F for dead code).

---

## 6. Decisions Required Before Implementation

Per the brief, no silent changes. The following items require an **explicit decision** before Phase A:

1. **ADR-DOM-OVERDUE** — Payments says 14 d overdue, Invoices says 30 d. Align, document, or leave as-is? **Do not silently change.**
2. **ADR-HEADER-SEARCH** — Replace stub with command palette now, or defer to Phase C?
3. **ADR-DEPS-CLEANUP** — `recharts`, `@radix-ui/*`, `xlsx` — adopt now or remove in Phase F?
4. **ADR-PROXY-UTILS** — Adopt `_proxy-utils.ts` (Phase A) or delete (Phase F)?
5. **ADR-TESTS** — `vitest` + Playwright in Phase I, or earlier?

---

## 7. Next Step

Await **explicit approval** of:
1. The audit findings (this document).
2. The 7-phase roadmap (§4).
3. The 5 ADR decisions (§6).

Only after approval will Phase A begin — **no code changes today**.

---

## Appendix A — File Inventory

- 108 `.tsx` files (99 `'use client'`).
- 56 API routes; 22 are pass-through proxies to Tenant App.
- 9 services (`src/services/*.ts`).
- 4 hooks (`src/hooks/*.ts`).
- 1 AuthProvider, 1 WorkflowStepper, 1 WorkflowDiagram (presentational state-machine viz).
- 0 test files (no `*.test.ts(x)` found).

## Appendix B — Related Prior Audits

- `docs/super-admin-claims-payments-invoices-audit.md` (2026-08-04) — bulk-action state machine; **P0 fixed**.
- `docs/CLAIM_STATE_MACHINE_AUDIT.md` — canonical state machine reference.
- `docs/financial-operations-completeness-audit.md` — financial ops coverage audit.
- `RemedyGCC/COMMUNICATION_FEATURES_AUDIT.md` — claim communication audit (Phase 0–4).

## Appendix C — Glossary

- **RSC** — React Server Component.
- **LCP / TTI / CLS** — Core Web Vitals.
- **SW R** — Stale-While-Revalidate caching pattern.
- **ADR** — Architecture Decision Record.
- **N+1** — One parent query + N child queries, often unintentional.
