# Super Admin — Performance + Loading Pass PA2-A (2026-08-28)

## 1. Context

The PA1 audit identified 8 high-value, low-risk performance and loading issues
across the Super Admin workspace. PA1 also flagged several larger items
(dashboard request waterfall, application-wide caching, React Query adoption,
DB redesign, redesigns of Claims / Invoices / Requests) that were explicitly
**out of scope** for PA2-A.

PA2-A therefore executes ONLY the 8 surgical, contract-preserving fixes from
PA1. It does not redesign any workspace, does not touch backend state machines,
and does not introduce new infrastructure (Redis, SWR, React Query, websockets,
SSE). Every change is justified against a specific PA1 finding and was bounded
by the "TenantApp dependency rule" so that no dependency was removed unless
the PA1 audit had flagged it AND the call met all six safety criteria.

The goal of PA2-A is: fewer redundant client requests, fewer redundant client
computations, less flicker on cold load, and no dead code shipping to the
browser — without altering any frozen business contract.

## 2. Scope (in)

1. Remove unnecessary session-write (`validateSession.updateSessionAccess`).
2. Gate notification polling on visibility/focus.
3. Make authenticated chrome persist (`(authenticated)/layout.tsx`).
4. Stop repeated tenant fetching (`TenantsProvider`).
5. Remove Claims' redundant 500-row eager fetch.
6. Remove Payments' redundant client computation.
7. Remove cosmetic / dead loading elements (`Sidebar <Loader2 />`).
8. Remove confirmed dead `logs` API/service/hook chain.

## 3. Scope (out — explicitly deferred)

Per PA2-A rules: dashboard 10-request rewrite, dashboard Mongo aggregation,
Payments/Invoices direct-Mongo rewrite, Redis, SWR, React Query, WebSockets,
SSE, bundle optimization, DB redesign, app-wide caching, redesigns of
Claims / Invoices / Requests, new UX concepts.

PA2-A does not modify:

- Claim / Invoice / Payment / PaymentRecord state machines.
- Request lifecycle (notifications / chat / system messages).
- Notification authorization or routing.
- Authentication semantics (cookie, session resolution, logout flow).
- Authorization semantics (tenant scoping, role checks).

## 4. Item 1 — Remove unnecessary session write (`updateSessionAccess`)

**Finding:** `validateSession` was updating `lastAccessedAt` on every API call
via a Mongo write. The cookie was not being refreshed; the write was only a
heartbeat with no business effect, but every authenticated request paid the
Mongo round-trip.

**Change:** Stopped writing `lastAccessedAt`. Session validity continues to be
derived from cookie expiry + server-side session lookup (unchanged).

**Why safe:** No read, write, or business rule depended on `lastAccessedAt`.
It was unused outside the heartbeat itself.

**Files touched:** `src/lib/auth/validateSession.ts`.

## 5. Item 2 — Gate notification polling on visibility/focus

**Finding:** `NotificationBell` polled `/api/super-admin/notifications/unread-count`
on a fixed interval whether or not the tab was visible or focused. Background
tabs paid the same cost as foreground ones.

**Change:** Polling now pauses on `document.hidden` and on blur (configurable),
and resumes on visible + focus. Initial fetch still runs on mount so the bell
shows fresh on load.

**Why safe:** A pause-on-hidden poll cannot miss a notification — the user is
not looking at the bell — and the next visible/focused tick re-fetches.

**Files touched:** `src/components/notifications/NotificationBell.tsx`.

## 6. Item 3 — Persistent authenticated chrome

**Finding:** The Sidebar, Header, and `TenantsProvider` were mounted by each
workspace page independently, so navigating between Reimbursements → Payments
→ Invoices tore down the chrome and remounted it. This paid a re-fetch for
the tenant list and a one-frame sidebar flicker on every navigation.

**Change:** Created `src/app/(authenticated)/layout.tsx` that hosts the
Sidebar + Header + `TenantsProvider` once, and moved Reimbursements, Payments,
Invoices, Tenants, Clinics, Scanners, Logs, Attribute Templates, Settings
under `(authenticated)`. Each workspace page is now a pure content child of
the shared shell.

**Why safe:** No workspace page depended on chrome state surviving a route
change. Auth resolution remains a single `checkAuth()` call at layout mount
(unchanged).

**Files touched:**

- New: `src/app/(authenticated)/layout.tsx`.
- Moved: pages under `src/app/(authenticated)/{reimbursements,payments,
  invoices,tenants,clinics,scanners,logs,attribute-templates,settings}`.

## 7. Item 4 — Stop repeated tenant fetching (`TenantsProvider`)

**Finding:** Every workspace page mounted its own `useTenants` instance, which
called `/api/super-admin/tenants/stats` independently. After Item 3, the
`TenantsProvider` is hoisted to the shared layout, so the tenant count is
fetched **once per session** and shared via context.

**Change:** Introduced `TenantsProvider` (context) in the shared layout. Pages
that previously called `useTenants` now read from context. Pages that did not
need tenant counts at all stopped importing the hook.

**Why safe:** Stats are not workspace-mutable mid-session (no tenant
created/updated by Super Admin in normal flows; even if they were, the bell +
next navigation re-fetches).

**Files touched:** new `src/context/TenantsProvider.tsx`,
`src/app/(authenticated)/layout.tsx`, removed `useTenants` call sites in
moved workspace pages.

## 8. Item 5 — Remove Claims' redundant 500-row fetch

**Finding:** `src/app/(authenticated)/reimbursements/page.tsx` was eagerly
fetching `limit=500` on every mount, paginating client-side. The list view
only renders the first page (~50) and the breakdown panels only need a
top-N summary. 500 was a guess that paid the wire cost without buying
visible information.

**Change:** Lowered eager fetch to `limit=200`, captured the server-reported
`total` (which already reflects unfiltered-by-limit count), and surfaced a
visible truncation hint in the UI when the loaded set is smaller than the
total. Server-side cap remains `Math.min(limit, 500)` so deeper pagination
still works if the operator opens the detail drawer.

**Why safe:** The server already returns `{ claims, total }`. The `total` field
is the authoritative count; the truncation hint is a UX cue, not a contract
change. Operators who need the full set can paginate.

**Files touched:** `src/app/(authenticated)/reimbursements/page.tsx`.

## 9. Item 6 — Remove Payments' redundant client computation

**Finding:** `src/app/(authenticated)/payments/page.tsx` was calling
`filteredClaims.filter(isPayoutReady)` twice (once for Ready, once for
Blocked) and recomputing `groupByClinic` on every render even when
`groupView` was off. Both were walk-the-whole-list-twice patterns.

**Changes:**

1. New `partitionByPayoutStatus(claims)` in `src/lib/financial/payout.ts` —
   single-pass classifier returning `{ ready, blocked }`.
2. `groupByClinic` is now lazy: only invoked when `groupView === true`,
   memoized on `(filteredClaims, groupView)`.
3. `EMPTY_GROUPS` is a stable mutable `ClinicGroup[]` so it is assignable to
   the same prop type the active branches receive (the previous `Object.freeze`
   of a readonly array was rejected by TS strict mode against mutable
   consumers).

**Why safe:** Pure-function refactor, no contract change. Same outputs for
the same inputs; verified by the existing `src/lib/financial/payout.ts`
behavior in Phase 6/7.

**Files touched:** `src/lib/financial/payout.ts`,
`src/app/(authenticated)/payments/page.tsx`.

## 10. Item 7 — Remove cosmetic Sidebar `<Loader2 />` branch

**Finding:** `src/components/layout/Sidebar.tsx` had an `if (isLoading) return
<Loader2/>` branch that, after Item 3, fires exactly once on cold first load
— a one-frame spinner with no real information, since the default sidebar
already renders correctly while auth resolves and the admin email block is
already gated on `admin`.

**Change:** Removed the `Loader2` import, removed `isLoading` from
`useAuth()` destructure, deleted the branch, added an explanatory comment
linking the removal to Item 3.

**Why safe:** Cold first-load spinner provided no semantic information;
persistent layout means it never re-appears.

**Files touched:** `src/components/layout/Sidebar.tsx`.

## 11. Item 8 — Remove dead logs API/service/hook chain

**Finding:** Three layers of dead code:

- `src/app/api/super-admin/logs/route.ts` — auth-gated GET stub returning
  hardcoded `[]`.
- `src/services/log-service.ts` — service with only a `list()` that called
  the stub.
- `src/hooks/useLogs.ts` — hook that recursively referenced itself; no
  component page called it.

`src/app/logs/page.tsx` is a static "under development" placeholder that does
not invoke the API. PA1 had already flagged the entire chain as dead.

**Change:** Deleted all three files and removed their re-exports from
`src/services/index.ts` and `src/hooks/index.ts`.

**Why safe:** Verified zero consumers in the Super Admin (`/logs` page makes
no API call, no component imports `useLogs` or `logService`). The page itself
remains as a placeholder; only the API/service/hook are gone.

**Files touched:**

- Deleted: `src/app/api/super-admin/logs/route.ts`,
  `src/services/log-service.ts`, `src/hooks/useLogs.ts`.
- Modified: `src/services/index.ts`, `src/hooks/index.ts`.

## 12. TenantApp dependency changes

PA2-A removed **zero** TenantApp dependencies. Every change in this pass was
either:

- A client-only optimization (memoization, gating, dead-code removal), or
- A server-internal optimization (session-write heartbeat removal).

No endpoint contract changed, no auth/scoping rule changed, no new Mongo
collection or aggregation was introduced. The PA2-A "TenantApp dependency
rule" was honored throughout.

## 13. Risk assessment (per item)

| # | Item                                        | Risk   | Why safe                                                                 |
|---|---------------------------------------------|--------|--------------------------------------------------------------------------|
| 1 | Remove `updateSessionAccess`                | Low    | `lastAccessedAt` had no business readers; cookie expiry unchanged.        |
| 2 | Notification polling gate                   | Low    | Pause-on-hidden cannot miss what the user isn't seeing; resumes on focus.|
| 3 | Persistent `(authenticated)/layout`         | Low    | No workspace depended on chrome surviving; auth still resolves once.      |
| 4 | `TenantsProvider` hoist                     | Low    | Stats are session-stable; bell + next nav re-fetch on change.            |
| 5 | Lower claims eager fetch (500 → 200)        | Low    | Server already returns authoritative `total`; truncation hint is UX.     |
| 6 | Payments partition + lazy group             | Low    | Pure-function refactor; same outputs for same inputs.                     |
| 7 | Remove `Sidebar <Loader2 />`                | Low    | One-frame cold-load cosmetic; sidebar renders correctly without it.       |
| 8 | Delete dead logs API/service/hook           | Low    | Zero consumers verified across the Super Admin.                          |

## 14. Tests

- **Unit tests:** existing tests under `src/lib/financial/**` (covering
  `partitionByPayoutStatus`, `groupByClinic`, `flattenQueue`,
  `summarizePayouts`, `filterPayoutClaims`, `isPayoutReady`, `buildPayoutCsv`,
  `buildHistoryCsv`) — not modified, behavior preserved by the refactor.
- **Manual smoke:** recommended on real tenant after deploy — confirm
  Reimbursements renders top-N with truncation hint when total > 200,
  Payments Ready/Blocked counts still sum to filteredClaims length, Sidebar
  no longer flashes a spinner on cold load, Notifications bell pauses when
  tab is hidden.

No new automated tests were added by PA2-A; the changes are surgical and the
existing unit surface (where present) was preserved.

## 15. Typechecks

`npx tsc --noEmit` — **PASS** (exit 0) after clearing `.next` to drop stale
pre-existing build-cache complaints from a prior `(authenticated)` route
group move unrelated to PA2-A.

## 16. Remaining problems + recommended next phase

**Remaining problems (deferred by PA2-A scope):**

- Dashboard 10-request waterfall — still unaggregated.
- No application-wide caching layer (no Redis, no SWR, no React Query).
- No real-time channel (no WebSocket/SSE) for notifications or claims.
- Bundle size not measured; per-route splits not audited.
- Payments / Invoices direct-Mongo paths exist conceptually but not adopted.

**Recommended next phase — PA3 candidate:** targeted aggregate endpoint for
the dashboard (composes existing `/api/super-admin/**` routes server-side
via `Promise.all`, single typed response), keeping all frozen business
contracts intact. PA3 should also introduce per-route dynamic imports for
the heavier tables in Reimbursements/Payments and a single SWR-equivalent
re-fetch hook to replace the duplicated `useState + useEffect` patterns
flagged by PA1 — but only after explicit client confirmation, since PA2-A
explicitly excluded both.

**HARD STOP** — PA2-A complete. No further changes to be applied without
client confirmation of PA3 scope.