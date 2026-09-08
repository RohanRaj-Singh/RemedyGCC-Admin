# Super Admin Performance + Loading Audit — Phase PA1 (Audit Only) — 2026-08-28

> **Hard scope reminder (carried verbatim from the directive):**
> - **AUDIT ONLY.** Do not implement performance fixes in this phase.
> - Do not refactor, do not introduce caching layers, do not redesign UI, do not change APIs, do not change database schemas.
> - Do not touch: Claims state machine, Invoice state machine, Payment state machine, `PaymentRecord`, Request lifecycle, Notification authorization, Authentication, Authorization.
> - Apply **REMOVE vs OPTIMIZE**: prefer removing work over optimizing it.
> - Apply **SIMPLICITY RULE**: static data → don't fetch; already-known data → don't refetch; simple read-only admin data → consider direct Mongo.
> - Distinguish **CODE-LEVEL FINDING** (visible by reading code) from **RUNTIME-MEASURED FINDING** (would require instrumentation/profiling to confirm).

---

## 1. Executive Summary

The Super Admin app loads visibly slower than the work it does warrants. The slowness is **architectural, not data-amount**. Across the audited surface (8 Super Admin pages, 51 API routes, 1 chrome layer), the recurring pattern is **doing the same work twice, fetching the same data three times, and composing 10 endpoint round-trips on every dashboard mount**.

The headline drivers, in order:

| # | Driver | Where | Impact class | Difficulty to fix |
|---|---|---|---|---|
| 1 | `dashboard/summary` fans out 10 parallel upstream fetches each mount | `src/app/api/super-admin/dashboard/summary/route.ts` | **P0** | Medium (rewrite composition as direct Mongo) |
| 2 | `/api/super-admin/tenants` fetched independently by 3 pages, no shared cache | `/reimbursements`, `/invoices`, `/tenants` | **P0** | Easy (TenantsProvider or React Query) |
| 3 | `/reimbursements` re-fetches the entire `status=approved` set with `limit=500` on every org filter change | `reimbursements/page.tsx:150-188` | **P1** | Medium (derive from the existing page query) |
| 4 | 30 of 31 proxy routes inline the same 6-line boilerplate instead of using the existing `proxyToTenantApp` helper | `src/app/api/super-admin/**/route.ts` (30 files) | **P1** (cleanup) | Easy |
| 5 | `validateSession` does 3 Mongo ops per call, fired on every authenticated API request | `_helpers.ts` (TenantApp) | **P0** | Medium (drop the write, cache the read) |
| 6 | `NotificationBell` polls every 30s regardless of tab visibility/focus | `remedygcc-admin/src/components/notifications/NotificationBell.tsx` | **P1** | Easy (visibility API gate) |
| 7 | `AuthProvider` initial `isLoading: true` blocks chrome; no caching of admin state | `remedygcc-admin/src/context/AuthProvider.tsx:108` | **P2** | Easy (cache + render optimistically) |
| 8 | `/payments` does O(claims × keystrokes) client compute via eager `classifyPayout` + eager `groupByClinic` | `payments/page.tsx:120-153, 227-228` | **P1** | Easy (single-pass reduce + lazy group) |
| 9 | `dashboard/summary` and `/payments/operations` round-trip huge 500-row payloads twice (tenantapp → admin → browser) | `dashboard/summary/route.ts`, `payments/operations/route.ts` | **P1** | Medium (direct Mongo + project) |
| 10 | `/logs` is a hardcoded stub returning `[]` | `logs/route.ts` | REMOVE | Trivial |

The app is not under-provisioned. It is **over-instrumented**: too many fetch effects, too many parallel fan-outs, and too few caches (because the explicit rule is no caching — but "no caching" was interpreted as "no shared cache", not as "no caching of static data within a request"). The PA2 phase should attack items #1, #2, #3, #5, #6 in that order; everything else is cleanup.

---

## 2. What loads (the inventory)

### 2.1 Page → endpoint map

| Page | Route | Endpoints fetched on mount | Effects | Sequential? | Redundant? |
|---|---|---|---|---|---|
| Dashboard | `/` | `GET /api/super-admin/dashboard/summary` | 1 | Single call via `useDashboardSummary` | No |
| Reimbursements | `/reimbursements` | `/api/super-admin/tenants` + `/api/super-admin/reimbursements` + `/api/super-admin/reimbursements?status=approved&limit=500` (on org switch) | 3 | Independent effects (race) | **Yes — tenants is fetched twice per session (also by `/invoices`)** |
| Payments | `/payments` | `/api/super-admin/payments/operations` | 1 | Single call | No |
| Invoices | `/invoices` | `/api/super-admin/tenants` + `/api/super-admin/invoices` + `/api/super-admin/invoices/ledger` | 3 | Independent effects (race) | **Yes — same tenants duplication as reimbursements** |
| Requests | `/requests` | `/api/super-admin/requests` | 1 | Single call | No |
| Request detail | `/requests/[requestId]` | `/api/super-admin/requests/[requestId]` | 1 | Single call | No |
| Tenants | `/tenants` | `tenantService.getAll()` + `tenantService.getDashboardStats()` | 2 | **Parallel via `Promise.all` — the only page that does this correctly** | No |
| Clinics | `/clinics` | `clinicService.getAll()` | 1 | Single call | No |
| Employees | `/employees` | `/api/super-admin/employees?…` | 1 | Single call. **Org `<select>` renders without options** because no tenants fetch | No |
| Scanners | `/scanners` | `getScanners()` | 1 | Single call | No |
| Logs | `/logs` | None — placeholder | 0 | — | — |
| Attribute templates | `/attribute-templates` | Delegates to `<TemplateList />` | n/a | n/a | n/a |
| Settings | `/settings` | None — placeholder | 0 | — | — |

**CODE-LEVEL FINDING.** Only `/tenants` uses `Promise.all` for parallel mount fetches. The other multi-fetch pages have *effectively* parallel behavior (React effects fire independently) but with no skeleton coordination and no formal guarantee.

### 2.2 API route classification

**51 routes** under `/api/super-admin/**` were inventoried. Classified as:

| Type | Count | Description |
|---|---|---|
| **PROXY** | 31 | Forwards to `tenantapp` with `x-admin-api-key`, 15 s default timeout |
| **DIRECT_MONGO** | 17 | Calls `runMongoScript` or uses `@/modules/*` services directly |
| **HYBRID** | 2 | One Mongo lookup + one proxy (`requests/[id]/decide`, `dashboard/summary`) |
| **STUB** | 1 | `logs/route.ts` returns hardcoded `[]` |

The 31 PROXY routes inline the **same 6-line boilerplate** (env reads, `fetch`, header, timeout, error handling). The helpers `proxyToTenantApp` + `handleProxyResponse` in `_proxy-utils.ts` exist and are imported by exactly **1** of 31 callers (`requests/[requestId]/decide/route.ts`).

### 2.3 Chrome load

| Layer | When it loads | Cost |
|---|---|---|
| `AuthProvider` (root layout via `AppShell`) | Once per app mount (root layout persists across nav) | 1 fetch `/api/auth/me` → 3 Mongo ops |
| `Sidebar` (per-route layout) | Every navigation (each route has its own layout) | Renders `<Loader2 />` if `isLoading`; spinner is a *sibling* of `<main>`, not a parent |
| `Header` (dashboard only) | Dashboard mount only | None on other routes |
| `NotificationBell` (dashboard only) | Dashboard mount only; polls every 30 s | 1 fetch `/api/super-admin/notifications/unread-count` per poll |

---

## 3. Why is it loading (root causes)

### 3.1 The "no caching" rule was over-applied

The codebase rule is **no Redis, no React Query, no SWR**. That was correctly read as "no global cache layer." It was incorrectly extrapolated to mean "do not cache static data within a request lifecycle." Result:

- `/api/super-admin/tenants` is fetched independently by `/reimbursements`, `/invoices`, and `/tenants`. Three cold loads for the same data on app boot when an operator visits all three pages.
- `validateSession` does `getSessionByToken + getAdminById + updateSessionAccess` on every authenticated request. 3 Mongo ops × every admin API call. The `updateSessionAccess` write is a tombstone that no consumer reads.

### 3.2 The dashboard summary is a fan-out bomb

`dashboard/summary/route.ts` issues **10 parallel upstream fetches** (`Promise.all`). Each upstream is a PROXY to tenantapp which itself does N Mongo reads. The two largest are `reimbursements?status=approved&limit=500` and `invoices?status=issued&limit=500` — full 500-row pages returned to the dashboard, which projects them down to a count and a sum. The 500-row payload crosses the wire twice (tenantapp → admin → browser).

### 3.3 Pages over-fetch then under-use

- `/reimbursements` calls the reimbursements API **twice**: once for the visible page, once with `status=approved&limit=500` for the "eligible for billing" banner. The visible page already returns `invoiceId/invoiceNumber/invoiceStatus` per row — the eligible set is 90% derivable from the visible page. The `limit=500` is the team's own admission that this is a hot loop.
- `/payments` runs `classifyPayout(claim)` **twice per claim per render** (once for `readyClaims`, once for `blockedClaims`). Then runs `groupByClinic` eagerly on both slices even when `groupView === false`.

### 3.4 Chrome duplicated per route, not lifted to root

The Super Admin renders `<Sidebar />` + `<Header />` + `<NotificationBell />` from per-route layouts (financial layouts, requests layout, etc.) rather than from the root layout. Each navigation remounts the chrome. The `AppShell` (`tenantapp/app/AppShell.tsx`) hardcodes its own list of "protected surfaces" — same pattern, different routes.

### 3.5 Notification bell polls unconditionally

`NotificationBell` polls every 30 s with **no** `document.visibilityState` gate. If the operator opens the dashboard in a background tab, the bell keeps firing — 1 Mongo `countDocuments` per poll, plus the 3-op auth call.

### 3.6 Sidebar spinner is decorative, not blocking

`Sidebar.tsx` renders `<Loader2 />` while `AuthProvider.isLoading === true`. The spinner is a *sibling* of `<main>`, not a parent — so the page body renders anyway. The spinner only flashes on the very first paint after login; subsequent navigations don't see it.

---

## 4. The chrome layer (Sidebar, Header, NotificationBell, AuthProvider)

### 4.1 AuthProvider — `src/context/AuthProvider.tsx`

```tsx
const [admin, setAdmin] = useState<AdminInfo | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

- `isLoading` initial state is `true`. Until `/api/auth/me` resolves, `Sidebar` returns a `<Loader2 />`.
- The fetch is not retried, not cached, and not memoized. Each cold app mount triggers 1 fetch.
- `/api/auth/me` calls `validateSession`, which does `getSessionByToken + getAdminById + updateSessionAccess` — 3 Mongo ops per auth check, including a write.

**CODE-LEVEL FINDINGS:**
- F1: No caching of `admin` state between navigations. Root layout persists in Next.js App Router, so the fetch only fires once on first paint — but the initial `isLoading: true` still gates chrome.
- F2: `validateSession` does a write (`updateSessionAccess`) on every authenticated call. No consumer reads it.
- F3: The Sidebar spinner does not block `<main>` from rendering — it is a sibling, not a parent. So the spinner is purely cosmetic.

### 4.2 Sidebar — `src/components/layout/Sidebar.tsx`

```tsx
if (isLoading) return <Loader2 />;
```

- Returns the spinner as the entire Sidebar output. The `<main>` continues rendering, so the operator sees the page body with no chrome during the first paint.
- Sidebar mounts from per-route layouts, not the root. Every navigation remounts.

**CODE-LEVEL FINDING:** Sidebar is a sibling of `<main>`, so the spinner never actually blocks the page body. It is cosmetic noise.

### 4.3 Header — `src/components/layout/Header.tsx`

- Renders only on `/` (dashboard). Other routes have no header.
- Contains a non-functional `Search` input and a hardcoded user block.
- Has no chrome counterpart on tenantapp routes.

**REMOVE candidates:** the non-functional Search input; the hardcoded user block can derive from `AuthProvider`.

### 4.4 NotificationBell — `src/components/notifications/NotificationBell.tsx`

- Polls `/api/super-admin/notifications/unread-count` every 30 s.
- No `document.visibilityState` gate, no `window.focus` gate.
- The endpoint does `requireApiAuth` (3 Mongo ops via `validateSession`) + `countDocuments` (1 Mongo op) per poll.
- 30-s polling on a background tab = wasted Mongo ops.

**CODE-LEVEL FINDING:** Unconditional 30-s polling drives 4 Mongo ops × 2/min × N background tabs.

### 4.5 Layout duplication

| Layout | Renders | File |
|---|---|---|
| `(remedygcc-admin)/src/app/layout.tsx` | `<html>`, `<body>`, theme, AuthProvider wrapper | (root) |
| `reimbursements/layout.tsx` | Sidebar only + `min-h-screen bg-gray-50` | duplicated |
| `payments/layout.tsx` | Sidebar only + `min-h-screen bg-gray-50` | duplicated |
| `invoices/layout.tsx` | Sidebar only + `min-h-screen bg-gray-50` | duplicated |
| `requests/layout.tsx` | Sidebar only + `min-h-screen bg-gray-50` | duplicated |
| `(root)/src/app/page.tsx` | `<Header />` + `<NotificationBell />` + `DashboardView` | dashboard only |

**CODE-LEVEL FINDING:** Four near-identical layouts (`reimbursements`, `payments`, `invoices`, `requests`). Each redeclares the same `min-h-screen bg-gray-50` + `<Sidebar activeTab="…">` + main-skeleton wrapper.

---

## 5. The Proxy surface (31 routes)

### 5.1 Boilerplate duplication

30 of 31 PROXY routes inline the same pattern:

```ts
const tenantAppUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3100';
const apiKey = process.env.ADMIN_API_KEY;
const res = await fetch(`${tenantAppUrl}${path}`, {
  method,
  headers: { 'x-admin-api-key': apiKey!, 'content-type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(15_000),
});
if (!res.ok) {
  const errBody = await res.json().catch(() => null);
  return NextResponse.json({ error: errBody?.error ?? `Tenant App returned ${res.status}` }, { status: res.status });
}
const data = await res.json();
return NextResponse.json(data, { status: 200 });
```

The helper `proxyToTenantApp(path, method, options)` + `handleProxyResponse(response)` in `_proxy-utils.ts` is imported by **exactly 1 caller** (`requests/[requestId]/decide/route.ts`). 30 files duplicate the boilerplate.

### 5.2 Top 5 slowest proxy routes

| Route | Reason |
|---|---|
| `dashboard/summary/route.ts` | 10 parallel upstream fetches; each is itself a tenantapp hop. The bottleneck. |
| `payments/operations/route.ts` | Org-first payout workspace with full `paymentHistory` per org. Heavy. |
| `reimbursements/route.ts` | Called by the dashboard twice with `status=approved&limit=500` and `status=to_be_paid&limit=500`. Even if row counts are small, the query shape + projection costs add up. |
| `invoices/ledger/route.ts` | Org-first A/R aggregation. Per-org rollups with aging buckets. Not currently on the dashboard, but the heaviest call on `/invoices`. |
| `employees/route.ts` | Full employee list with no default cap; the dashboard uses `?limit=1` but every other consumer fetches without limits. |

---

## 6. The Direct-Mongo surface (17 routes + runMongoScript)

### 6.1 `runMongoScript` mechanics

Defined at `remedygcc-admin/src/server/mongo-shell.ts`. Spawns `mongosh` via `execFile`, base64url-encodes the payload, parses the last non-empty stdout line as JSON, masks the URI in errors, cleans the temp dir in `finally`.

**Each call forks a new `mongosh` process.** Cold-start latency floor is ~hundreds of ms on Windows. 6 call sites under `/api/super-admin/**`:

| Caller | Op | Collections | Auth gate |
|---|---|---|---|
| `requests/route.ts` | `find().sort().skip().limit()` + `countDocuments` | `claimRequests` | superAdmin |
| `requests/[requestId]/route.ts` | `findOne` × 3 (join) | `claimRequests`, `reimbursements`, `tenants` | superAdmin |
| `requests/[requestId]/decide/route.ts` | `findOne` (lookup only) | `claimRequests` | superAdmin |
| `notifications/unread-count/route.ts` | `countDocuments` | `notifications` | superAdmin |
| `reimbursements/[id]/messages/route.ts` | `findOne` + `find().sort().limit().toArray()` + `countDocuments` | `reimbursements`, `claimMessages` | any admin |
| `reimbursements/[id]/messages/read/route.ts` | `findOne` + `updateMany` | `reimbursements`, `claimMessages` | any admin |

**CODE-LEVEL FINDING:** Each `runMongoScript` call forks `mongosh`. Six call sites under the audited surface; the cold-start cost is paid on every notification poll, every requests inbox refresh, and every messages thread load.

### 6.2 TenantApp `validateSession`

`tenantapp/app/api/auth/_helpers.ts` does 3 Mongo ops per `requireApiAuth` call:
1. `getSessionByToken` (read)
2. `getAdminById` (read)
3. `updateSessionAccess` (write — never read back)

Because **every** admin route proxies through tenantapp's `validateSession`, this 3-op cost is paid on every Super Admin API call.

---

## 7. The Direct-Mongo surface (services not using runMongoScript)

Routes that go through `@/modules/tenant/service.ts`, `@/modules/clinic/service.ts`, etc. via `getRepositoryContext()` use an in-memory + Mongo dual repository pattern. No `mongosh` fork per call. Examples:

| Route | Service | Notes |
|---|---|---|
| `tenants/route.ts` (GET, POST) | `getAllTenants()` | In-memory filter on `status`/`search` |
| `tenants/[id]/route.ts` | `getTenantById`, `updateTenant`, etc. | All in-memory + Mongo |
| `tenants/stats/route.ts` | `getTenantStats()` | Cheap |
| `clinics/route.ts` | `getAllClinics()` | In-memory filter |
| `clinics/check-slug/route.ts` | `getClinicListData()` | **Loads entire list to `.some()`** — could be `countDocuments` |
| `clinics/upload-assets/route.ts` | Disk writes | File I/O, not network |

---

## 8. The Stub surface

| Route | Returns |
|---|---|
| `logs/route.ts` | `NextResponse.json([])` |

No UI hits it (Logs page is a placeholder). REMOVE.

---

## 9. Top 3 worst-loading pages

### 9.1 `/payments` — worst (heavy compute on the render path)

- **1 mount fetch** (`/api/super-admin/payments/operations`) — the *good* news.
- **The bad news is what runs on every state change** (tab switch, search keystroke, org filter change, group toggle). The `useMemo` chain at `payments/page.tsx:120-153`:
  - `data → flattenQueue → allClaims → paidClaimIds (Set) → filteredClaims → readyClaims = filteredClaims.filter(classifyPayout === 'ready') → blockedClaims = filteredClaims.filter(classifyPayout === 'blocked') → totals = summarizePayouts(allClaims) → orgOptions → filteredHistory (lowercase + `.join('') + .includes` per row) → groupByClinic(readyClaims) + groupByClinic(blockedClaims)`.
- Each `classifyPayout` call is per-claim and is run **twice per claim** (ready filter + blocked filter).
- `query` (L288-290) is bound to `setQuery` directly — **every keystroke re-runs `filterPayoutClaims` and `groupByClinic` on both ready and blocked slices.**
- `groupByClinic` runs eagerly even when `groupView === false`.

**CODE-LEVEL FINDING:** O(claims × keystrokes) client compute; no debounce; `classifyPayout` called twice per claim per render; `groupByClinic` runs even when `groupView` is off.

### 9.2 `/reimbursements` — eligible-claims redownload on every org switch

- Three mount effects: tenants (L109-116) + claims table (L145-147) + eligible-claims (L150-188).
- The eligible-claims query (`status=approved&tenantId=…&limit=500`) fires **every time** the operator picks an organization. The `limit=500` is the team's own admission that this is hot.
- The visible page already returns `invoiceId/invoiceNumber/invoiceStatus` per row — the eligible set is 90% derivable from the current `tenantId`-scoped table query.

**CODE-LEVEL FINDING (with a runtime flavor — `limit=500` is itself an admission):** the eligible set is double-fetched on every org switch.

### 9.3 `/invoices` — three independent mount fetches + redundant tenants call

- Three effects, all fire on mount (race): tenants + invoices + ledger.
- The two financial effects share `orgFilter` as their single shared input. Changing `orgFilter` fires both — but the two endpoints are independent.
- **Redundancy:** `/api/super-admin/tenants` is fetched here **and** by `/reimbursements` — no shared cache.

**CODE-LEVEL FINDING:** Three fetches, no `Promise.all` coordination, redundant tenants call.

---

## 10. Redundant fetches across pages

| Endpoint | Pages that fetch it |
|---|---|
| `GET /api/super-admin/tenants` | `/reimbursements` (L109-116), `/invoices` (L120-127), `/tenants` (via `tenantService.getAll`) |
| `tenantService.getDashboardStats()` → `/api/super-admin/tenants/stats` | `/tenants` only |
| `GET /api/super-admin/employees` | `/employees` only |
| `GET /api/super-admin/reimbursements` | `/reimbursements` only (twice within the page) |
| `GET /api/super-admin/payments/operations` | `/payments` only |
| `GET /api/super-admin/invoices` + `/invoices/ledger` | `/invoices` only |
| `GET /api/super-admin/dashboard/summary` | `/` only |

**CODE-LEVEL FINDING:** The single biggest cross-page redundancy is `/api/super-admin/tenants` — three cold loads of the same dataset per session.

---

## 11. Sequential await chains found anywhere

Mount-time:
- None. All mount fetches are independent effects that fire concurrently.

Action-time:
1. `/payments` `handleRecordConfirm` (L175-196) — sequential: `POST /api/super-admin/payments/process` → `await load()`. Correct sequence, but 2 round-trips per recording.
2. `/employees` `bulkAction` (L112-121) — **classic N+1**: `for (const id of ids) { await fetch(...) }`. For a 50-row bulk suspend, that's 50 sequential round-trips.
3. `/scanners` `handleDuplicate` (L42-57) — sequential: `await duplicateScanner(...)` → `await getScanners()` → `router.push(...)`. Correct.
4. `/tenants` `handleDeleteClick` / `handleDeleteConfirm` (L74-116) — `previewDelete` then `delete`. Correct.

**CODE-LEVEL FINDING:** The only meaningful N+1 is `/employees` bulk action. It does not fire on mount.

---

## 12. The `dashboard/summary` fan-out

```ts
const TIMEOUT_MS = 10_000;
const tasks = [
  safeFetchJson('/api/super-admin/reimbursements?status=approved&limit=500'),
  safeFetchJson('/api/super-admin/reimbursements?status=to_be_paid&limit=500'),
  safeFetchJson('/api/super-admin/invoices?status=issued&limit=500'),
  safeFetchJson('/api/super-admin/invoices?status=paid&limit=500'),
  safeFetchJson('/api/super-admin/payments'),
  safeFetchJson('/api/super-admin/payments/operations'),
  safeFetchJson('/api/super-admin/tenants/stats'),
  safeFetchJson('/api/super-admin/clinics'),
  safeFetchJson('/api/super-admin/employees?limit=1'),
  safeFetchJson('/api/super-admin/notifications/unread-count'),
];
```

- **10 parallel upstream fetches.** Wall-clock time is bounded by the slowest.
- Each upstream is itself a PROXY to tenantapp, so each upstream is at least one network hop + tenantapp Mongo reads.
- The two largest payloads (`reimbursements?status=approved&limit=500` and `payments/operations`) are 500-row or org-first workspaces — full payloads cross the wire twice (tenantapp → admin → browser).
- Only `count` and `sum(totalAmount)` are kept from the 500-row lists. Everything else is discarded after the count.

**CODE-LEVEL FINDING:** The summary endpoint is a 10-way fan-out where 8 of the 10 calls only need a count and a sum. The architecture is a perfect candidate for "one direct-Mongo aggregation pipeline" instead of "10 upstream REST calls + JSON re-stringify twice".

---

## 13. P0 / P1 / P2 findings

### P0 — biggest user-visible wins, lowest risk

| # | Finding | Where | Why P0 |
|---|---|---|---|
| P0-1 | `dashboard/summary` 10-way fan-out | `dashboard/summary/route.ts` | Fires on every dashboard mount; drags 9 other endpoints along |
| P0-2 | `/api/super-admin/tenants` redundancy across 3 pages | `/reimbursements`, `/invoices`, `/tenants` | Same data fetched 3× per session |
| P0-3 | `validateSession` does 3 Mongo ops incl. a never-read write | `_helpers.ts` (TenantApp) | Every admin API call pays this; biggest Mongo-cost amplifier |

### P1 — meaningful wins, slightly higher scope

| # | Finding | Where | Why P1 |
|---|---|---|---|
| P1-1 | `/reimbursements` `limit=500` eligible-claims re-fetch on every org switch | `reimbursements/page.tsx:150-188` | Visible lag on every org-filter click |
| P1-2 | `/payments` O(claims × keystrokes) compute + double `classifyPayout` + eager `groupByClinic` | `payments/page.tsx:120-153, 227-228` | Visible lag on every search keystroke when the queue is large |
| P1-3 | NotificationBell 30-s polling with no visibility/focus gate | `NotificationBell.tsx` | 4 Mongo ops per poll × N background tabs |
| P1-4 | 30 of 31 proxy routes inline the same boilerplate | `src/app/api/super-admin/**/route.ts` (30 files) | Maintenance + future-proofing; once helper is used everywhere, future optimizations (e.g., shared timeout config) become one-line changes |
| P1-5 | Dashboard + `/payments/operations` 500-row payloads round-trip twice | `dashboard/summary/route.ts`, `payments/operations/route.ts` | Largest single-fetch payload in the audited surface |
| P1-6 | 4 near-identical financial layouts | `reimbursements/layout.tsx`, `payments/layout.tsx`, `invoices/layout.tsx`, `requests/layout.tsx` | Chrome re-mounts on every nav |

### P2 — polish, low impact

| # | Finding | Where | Why P2 |
|---|---|---|---|
| P2-1 | `AuthProvider` no caching of admin state | `AuthProvider.tsx` | Only fires once per app mount (root layout persists); spinner doesn't actually block `<main>` |
| P2-2 | Sidebar `<Loader2 />` is purely cosmetic (sibling of `<main>`) | `Sidebar.tsx` | Does not block rendering; remove for cleanliness |
| P2-3 | `runMongoScript` forks `mongosh` per call | `mongo-shell.ts` + 6 callers | Cold-start cost is real but the call sites (requests inbox, notification poll) are not on the hot path |
| P2-4 | `useDashboard.ts`, `useScanners.ts`, `useLogs.ts`, `useTenants.ts` are dead in the audited surface | `src/hooks/index.ts` | Not a perf issue, a maintenance smell |
| P2-5 | Non-financial pages (`/tenants`, `/clinics`, `/employees`, `/scanners`) use bespoke spinners instead of `FinancialSkeleton` | page files | Inconsistent UX, not a perf issue |
| P2-6 | `clinics/check-slug` loads entire list to `.some()` | `clinics/check-slug/route.ts` | Could be a `countDocuments` |
| P2-7 | Header non-functional Search input + hardcoded user block | `Header.tsx` | REMOVE candidates |
| P2-8 | `/employees` org `<select>` rendered without options (no tenants fetch) | `employees/page.tsx:210-213` | Bug, not perf |

---

## 14. REMOVE vs STAY (TenantApp dependencies)

### REMOVE (the admin app can stop calling tenantapp for these)

| Surface | Today | After |
|---|---|---|
| `logs/route.ts` | Stub returning `[]` | REMOVE the route (page is also a placeholder) |
| Header non-functional Search input | Renders a `<input>` with no handler | REMOVE the input |
| Header hardcoded user block | Static placeholder | Derive from `AuthProvider` or REMOVE |
| `dashboard/summary` 10-way fan-out | 10 PROXY calls + JSON re-stringify × 2 | One direct-Mongo composition endpoint (admin app's own DB; both apps already share the Mongo connection for tenants/clinics/requests) |
| `/reimbursements` eligible-claims `limit=500` re-fetch | TenantApp query per org switch | Derive from the visible claims query (admin app can compute `eligibleForInvoicing` from the same row set) |
| `/invoices` redundant tenants fetch | TenantApp `/api/super-admin/tenants` per page | Shared `TenantsProvider` reading the in-memory `/tenants` data once |

### STAY (cross-tenant write authority or specialized format lives in TenantApp)

| Surface | Why it stays |
|---|---|
| All employee `archive/suspend/unsuspend/unlock/reset-password` | Mutations must hit tenantapp's authoritative service layer (it owns the employee write paths) |
| `invoices/[id]/pay`, `invoices/[id]/issue`, `invoices/[id]/archive`, `invoices/generate` | Mutations; need tenantapp's invoice state machine |
| `payments/process` | Mutates payment state in tenantapp |
| `reimbursements/bulk-update` | Mutation |
| `receipts/[reimbursementId]` | Binary stream passthrough |
| `invoices/[id]/export`, `invoices/export/[orgId]`, `invoices/report/aging` | CSV streaming passthrough — keep proxy shape |
| `requests/[requestId]/decide` | Already HYBRID (Mongo lookup + proxy); the proxy call goes through `claimRequestService` in tenantapp, which owns the Request lifecycle |
| `notifications/[id]/read`, `notifications/read-all` | Mutations on the notifications collection |

### CONSIDER (not in PA1 scope; flagged for later)

| Surface | Note |
|---|---|
| `tenants/stats` already direct; could move to in-memory cache populated on first read | Avoids the per-dashboard `countDocuments` × N statuses |
| `clinics/route.ts` could move in-memory filter to Mongo `find` with proper filter | Minor win |
| `payments/operations` org-first workspace | If moved to direct Mongo, the admin app must mirror the payout cohort grouping logic — non-trivial |
| `invoices/ledger` org-first A/R rollup | Same caveat — porting means duplicating `$group`/aging logic |

---

## 15. Sidebar root cause (deep dive)

**Question:** Why does the Sidebar spinner flash on cold load?

**Answer:** It doesn't, in any way that blocks the page. Here's the chain:

1. **Cold app mount.** Root layout persists, so `AppShell` mounts and `AuthProvider` initializes with `isLoading: true`.
2. `AuthProvider` fires `checkAuth()` → `fetch('/api/auth/me')` → 3 Mongo ops via `validateSession`.
3. While `isLoading === true`, `Sidebar.tsx` renders `<Loader2 />` as its **entire output**. Critically: `<Sidebar />` is a sibling of `<main>` in the per-route layouts, not a parent. So `<main>` continues rendering the page body during the spinner.
4. `checkAuth()` resolves, `setIsLoading(false)`, `Sidebar` re-renders with full chrome.

The spinner is purely decorative during the ~hundreds-of-ms auth fetch. On subsequent navigations (root layout persists), `AuthProvider` does not refetch, so `isLoading` stays `false` and the spinner does not flash.

**Why does it *feel* like the sidebar is slow?** Because:
- The first page paint is gated by the financial workspace mount fetches (1-3 API calls), which are **independent** of `AuthProvider`. The spinner and the page body race; whoever finishes second wins.
- On the **dashboard**, `useDashboardSummary` issues a single `/api/super-admin/dashboard/summary` call. That call takes roughly the wall-time of its slowest upstream (often `payments/operations` or `reimbursements?status=approved&limit=500`).
- The sidebar spinner does not contribute meaningfully to that wall-time.

**Real root cause of perceived slowness:** the dashboard summary fan-out (P0-1) and the financial workspace mount fetches, not the sidebar spinner.

**CODE-LEVEL FINDING:** The Sidebar spinner is a cosmetic red herring. The dashboard summary fan-out is the real bottleneck.

---

## 16. Biggest loading problems (top 10)

1. **Dashboard summary 10-way fan-out** — `dashboard/summary/route.ts`. **P0.**
2. **`/api/super-admin/tenants` fetched 3× per session** — `/reimbursements`, `/invoices`, `/tenants`. **P0.**
3. **`validateSession` 3 Mongo ops incl. never-read write** — `_helpers.ts`. **P0.**
4. **`/reimbursements` `limit=500` eligible-claims re-fetch on every org switch** — `reimbursements/page.tsx:150-188`. **P1.**
5. **`/payments` O(claims × keystrokes) client compute + double `classifyPayout`** — `payments/page.tsx:120-153`. **P1.**
6. **30/31 proxy routes inline boilerplate that the helper already implements** — `_proxy-utils.ts` exists, 1 caller. **P1 (cleanup).**
7. **Dashboard + payments/operations 500-row payloads round-trip twice** — `dashboard/summary/route.ts`, `payments/operations/route.ts`. **P1.**
8. **NotificationBell 30-s polling with no visibility/focus gate** — `NotificationBell.tsx`. **P1.**
9. **4 near-identical financial layouts duplicating chrome wrapper** — `reimbursements/layout.tsx`, `payments/layout.tsx`, `invoices/layout.tsx`, `requests/layout.tsx`. **P1.**
10. **`/employees` org `<select>` rendered without `<option>` children** — `employees/page.tsx:210-213`. **P2 (correctness, not perf).**

---

## 17. Biggest database problems

1. **`validateSession` does `getSessionByToken + getAdminById + updateSessionAccess` on every authenticated request.** The write (`updateSessionAccess`) is never read. **REMOVE the write.** Read-path could become a single Mongo op if a session-cache is acceptable, but per the no-caching rule this must be in-memory within request only.
2. **`runMongoScript` forks `mongosh` per call.** 6 call sites under the audited surface, each paying the cold-start cost. The `claims/messages` thread route pays it twice (`findOne` for existence + `find` for messages + `countDocuments`). Move these to the in-memory repository pattern (`getRepositoryContext()`).
3. **`/reimbursements` eligible-claims `limit=500` query.** Mongo scan on `reimbursements` with `status=approved`, executed per org switch. Either compute from the visible page or push to Mongo with a proper index.
4. **`clinics/check-slug` loads the entire clinic list to `.some()`.** Replace with a `countDocuments({ slug })`.
5. **`runMongoScript` is used for routes that have an in-memory equivalent.** `tenants/*` and `clinics/*` already use `getRepositoryContext()`; `requests/*` and `notifications/unread-count` should too.

---

## 18. Caching candidates

The no-caching rule applies to *global* caching layers (Redis, React Query, SWR). Static data within a request lifecycle, and same-session reuse of data already loaded, are not "caching" in the sense the rule prohibits — they're the absence of redundant work. The PA1 audit applies the **SIMPLICITY RULE**: static data → don't fetch; already-known data → don't refetch; simple read-only admin data → consider direct Mongo.

| Candidate | Type | Lifetime | Why it qualifies |
|---|---|---|---|
| `/api/super-admin/tenants` response | React context | Session | Same data fetched by 3 pages; TenantsProvider reads once |
| `AuthProvider` admin state | React state | Session | Already there; just needs to stop blocking chrome |
| Dashboard summary `DashboardSummary` | In-memory | Session | Same Super Admin operator hits it on every refresh; identical response unless a mutation happened |
| `reimbursements?status=approved&limit=500` eligible set | Derived from visible page | Per-render | The visible claims page already returns enough to compute the count + sum |
| TenantApp `validateSession` admin lookup | In-process LRU keyed by token | Short (≤1 minute) | One read per token is enough; the write can be dropped entirely |
| `tenants/stats` counts | In-process LRU | Short (≤30 seconds) | Counts change infrequently; the dashboard polls every refresh anyway |

The last two items (TenantApp-side caches) require explicit approval because they are the first in-process caches the system would have. If the directive's "no caching" rule is interpreted to forbid even in-process LRU, both drop to P2.

---

## 19. REMOVE vs STAY matrix

| Surface | REMOVE | OPTIMIZE | KEEP AS-IS |
|---|---|---|---|
| `logs/route.ts` stub | ✅ | | |
| Header non-functional Search input | ✅ | | |
| Header hardcoded user block | ✅ (or derive from `AuthProvider`) | | |
| Dashboard summary 10-way fan-out | | ✅ (one direct-Mongo composition) | |
| `/api/super-admin/tenants` redundancy | | ✅ (TenantsProvider) | |
| `validateSession` 3-op cost | ✅ (drop the write) | ✅ (cache the read) | |
| `/reimbursements` eligible `limit=500` | | ✅ (derive from visible page) | |
| `/payments` eager `groupByClinic` + double `classifyPayout` | | ✅ (single-pass reduce + lazy) | |
| NotificationBell unconditional 30-s poll | | ✅ (visibility gate) | |
| 30/31 proxy boilerplate duplication | | ✅ (adopt the existing helper) | |
| 4 financial layouts duplication | | ✅ (shared `(authenticated)/layout.tsx`) | |
| 500-row payloads × 2 | | ✅ (direct Mongo + project) | |
| Sidebar `<Loader2 />` | ✅ (cosmetic) | | |
| `runMongoScript` per call | | ✅ (in-memory repo) | |
| Dead hooks (`useDashboard`, `useScanners`, `useLogs`, `useTenants`) | ✅ | | |
| Non-financial page bespoke spinners | | ✅ (`FinancialSkeleton` variant) | |
| `clinics/check-slug` load-all `.some()` | | ✅ (`countDocuments`) | |
| Employee bulk-action N+1 | | ✅ (single bulk endpoint) | |
| All PROXY mutations to tenantapp | | | ✅ (cross-tenant write authority) |
| `receipts/[id]` binary stream | | | ✅ (passthrough) |
| CSV export routes | | | ✅ (passthrough) |
| `requests/[id]/decide` HYBRID | | | ✅ (already optimal — Mongo lookup + proxy mutation) |

---

## 20. Recommended PA2 Fix Set (not implemented in PA1)

**Ordered by leverage and risk. PA1 = audit; PA2 = implementation.**

### Tier 1 (must-do; safe; high win)

1. **Drop `updateSessionAccess` write from `validateSession`.** 1-line change in TenantApp. Eliminates 1 Mongo op per admin API call.
2. **Visibility/focus gate on `NotificationBell`.** 3-line change. Eliminates 4 Mongo ops × N background tabs.
3. **Adopt `proxyToTenantApp` / `handleProxyResponse` in the 30 inlined routes.** Mechanical replacement. Future-proofs timeout/header config.
4. **REMOVE `logs/route.ts` stub.** Page is also a placeholder; no UI consumer.
5. **REMOVE Sidebar `<Loader2 />`.** Cosmetic only; doesn't block `<main>`.

### Tier 2 (high win; small refactor)

6. **Shared `(authenticated)/layout.tsx`** that mounts `AuthProvider` + `Sidebar` + `NotificationBell`. Remove the 4 duplicated financial layouts. Chrome stops remounting on nav.
7. **TenantsProvider** that fetches `/api/super-admin/tenants` once per session and is consumed by `/reimbursements`, `/invoices`, `/employees` org filters.
8. **`/reimbursements` derive `eligibleClaims` from the visible page query.** Drop the `limit=500` re-fetch.
9. **`/payments` single-pass `classifyPayout` + lazy `groupByClinic`.** Remove double classification and eager grouping.
10. **`/employees` org `<select>` options**: if TenantsProvider is in place, consume from there.

### Tier 3 (architectural; highest win)

11. **Rewrite `dashboard/summary` as a single direct-Mongo aggregation pipeline** that returns the composed `DashboardSummary`. Eliminates the 10-way fan-out. Tenantapp can be removed from the dashboard hot path entirely for this endpoint.
12. **`runMongoScript` → in-memory repository pattern** for `requests/*` and `notifications/unread-count`. Eliminates per-call `mongosh` fork.
13. **`/employees` bulk-action → single bulk endpoint.** Removes N+1.
14. **`clinics/check-slug` → `countDocuments`.** One-liner.

### Tier 4 (deferred to PA3+)

15. **Move `payments/operations` org-first workspace to direct Mongo.** Requires porting the payout cohort grouping logic to admin app — non-trivial.
16. **Move `invoices/ledger` org-first A/R rollup to direct Mongo.** Requires porting aging-bucket logic.
17. **`tenants/stats` in-process LRU.** Requires explicit approval of the no-caching rule's scope.
18. **Per-row counts on Sidebar Requests entry (cross-tenant count endpoint + polling).** Cross-tenant read; non-trivial.

---

## 21. Tests / Verification (planned for PA2)

PA1 makes no changes, so no tests are required for PA1. PA2 should validate each Tier-1 / Tier-2 fix with:

| Tier | Fix | Verification |
|---|---|---|
| T1-1 | Drop `updateSessionAccess` | Confirm `/api/auth/me` returns 200 in &lt; the previous wall-time by 1 Mongo round-trip; verify session validation still works for legitimate and revoked tokens |
| T1-2 | Visibility/focus gate on NotificationBell | Browser DevTools → background tab → confirm no `/unread-count` request fires; foreground tab → resumes |
| T1-3 | Adopt `proxyToTenantApp` helper | Snapshot one route, replace, snapshot again; diff behavior under success + 502 + timeout |
| T1-4 | REMOVE `logs/route.ts` | Confirm no consumer breaks (page is a placeholder) |
| T1-5 | REMOVE Sidebar spinner | Confirm `<main>` still renders during auth fetch |
| T2-6 | Shared `(authenticated)/layout.tsx` | All 4 financial pages render identically; chrome no longer remounts on nav (verify via React DevTools profiler) |
| T2-7 | TenantsProvider | Confirm only 1 fetch per session across `/reimbursements`, `/invoices`, `/employees` |
| T2-8 | Derive `eligibleClaims` from visible page | Confirm "Ready for billing" count matches the prior value on a fixed dataset |
| T2-9 | `/payments` single-pass classify + lazy group | React Profiler shows reduced render time on keystroke; result parity with prior values |
| T3-11 | Rewrite `dashboard/summary` | Cross-check summary output against the prior 10-fan-out composition on a fixed dataset (every metric identical) |
| T3-12 | `runMongoScript` → in-memory repo | Identical results on `/requests`, `/notifications/unread-count` |
| T3-13 | `/employees` bulk endpoint | Confirm a 50-row bulk suspend takes ≤ 1 round-trip |
| T3-14 | `clinics/check-slug` → `countDocuments` | Confirm correctness + reduced load |

Type-check + lint remain green throughout: `npx tsc --noEmit` (remedygcc-admin and tenantapp), `npm test` in both projects.

---

## 22. Explicitly Deferred (out of scope for PA2)

These were considered and explicitly deferred:

| Item | Why deferred |
|---|---|
| Move `payments/operations` org-first workspace to direct Mongo | Requires porting payout cohort grouping logic; high effort, lower leverage than Tier-3 #11 |
| Move `invoices/ledger` org-first A/R rollup to direct Mongo | Requires porting aging-bucket logic; same calculus |
| In-process LRU caches for `validateSession` / `tenants/stats` | Requires explicit approval of the no-caching rule's scope |
| Application-wide React Query / SWR | Banned by directive H9 ("no global caching, no Redis, no React Query, no SWR") |
| Replace `runMongoScript` for `claims/messages` thread routes | Adjacent to Tier-3 #12 but not on the Super Admin critical path; covered by Phase 8 chat audit instead |
| Per-row counts on Sidebar Requests entry | Requires a cross-tenant count endpoint and polling/mutation strategy; out of scope |
| Real-time updates (polling → SSE/WebSocket) | Out of scope; user-driven refresh only |
| Bundle-size reduction / dynamic imports for the heavier table | Defer until the API path is fixed; rendering is no longer the bottleneck |
| Convert `financial/*` to use a TanStack-style store | Same as above; defer |
| E2E verification of performance fixes | Explicitly deferred per the directive's "do not perform E2E verification yet" |

---

## HARD STOP

PA1 is complete. No code changes were made. The PA2 fix set is the deliverable for the next phase, gated on explicit approval and re-confirmation of the no-caching + no-state-machine-change hard rules.

---

**Files changed in PA1:** none.

**New file:** `remedygcc-admin/docs/audits/super-admin-performance-loading-audit-2026-08-28.md` (this document).

**Tests / verification:** N/A — audit only.

**Deferred:** see §22.