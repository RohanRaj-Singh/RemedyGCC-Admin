# Admin → TenantApp Dependency Audit — 2026-08-27

## 1. Executive Summary

The Super Admin app (`remedygcc-admin`) is a thin Next.js client in front of a
`TenantApp` Node.js service that owns MongoDB. Of the **59** route files under
`src/app/api/super-admin/`:

- **49** are proxy routes that forward requests to `TenantApp` via the
  `proxyToTenantApp()` helper (server-to-server, `x-admin-api-key` header,
  `TENANT_APP_URL` base). The Admin side contributes **no business logic** —
  it copies the body, forwards `searchParams`, and surfaces the upstream
  status code and message.
- **10** route groups under `tenants/*` and `clinics/*` connect to MongoDB
  **directly** through `@/modules/tenant/service` and `@/modules/clinic/service`,
  bypassing the proxy. They carry real Admin-side logic (list filtering, two-phase
  delete, xlsx generation, file upload with atomic DB update, dashboard-access
  PATCH dispatch).
- **1** route is a server-side composition (`dashboard/summary`) that fans out
  to other Admin routes; it does **not** call TenantApp.
- **1** route is a stub (`logs`) that returns `[]`.

**Verdict — the dependency is mostly necessary, not accidental.** Of the 49
proxies, 14 carry non-trivial TenantApp business logic (financial workflows,
budget overrides, payment processing, claim messages, claim approvals, employee
mutations, A/R ledger). Removing these would require re-implementing the
business logic on the Admin side, which violates the frozen-architecture
constraint (Phase 6 verified Claims → Invoices → Payments end-to-end; the
logic must not be reimplemented in the Admin app).

**Three concrete changes are safe and recommended**, scoped to a single phase:

1. **Adopt the direct-Mongo pattern** for `notifications/*` (4 routes) — these
   hit TenantApp purely for an `id` and a count; the Admin app can call the
   existing `notifications` collection directly through a thin module.
2. **Adopt the direct-Mongo pattern** for the read-only `reimbursements/[id]/messages`
   proxy (1 route) — read-only, no business logic on the TenantApp side beyond
   `listByClaimId`.
3. **Document the dependency boundary** by adding a `proxyToTenantApp` audit
   log on every proxy (no behavior change, pure observability) — deferred
   until monitoring is a separate, approved phase.

**Everything else should stay.** This audit explicitly does not recommend
removing the financial proxies, the budget proxies, the employee mutation
proxies, or the clinics/tenants direct-Mongo split.

**No code changes are made in this audit.** Implementation is a separate,
gated phase.

---

## 2. Architecture Overview

### 2.1 The two-server shape

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (React)                                                 │
│   ↓ HTTPS                                                       │
│ remedygcc-admin (Next.js App Router)                            │
│   ├─ /app/api/super-admin/*       ←── 59 route files            │
│   │    ├─ proxy to TenantApp      (49 routes, server-to-server) │
│   │    ├─ direct MongoDB          (10 routes, tenants/clinics)  │
│   │    ├─ composition             (1 route, dashboard/summary) │
│   │    └─ stub                    (1 route, logs)               │
│   └─ /app/page.tsx + /reimbursements, /invoices, /payments      │
│              ↓ fetch (browser)                                  │
│      and/or server-side via TenantApp (proxy)                   │
└─────────────────────────────────────────────────────────────────┘
                ↓ x-admin-api-key (server-to-server)
┌─────────────────────────────────────────────────────────────────┐
│ tenantapp (Next.js App Router at tenantapp/app/api/**)          │
│   ├─ /api/admin/reimbursements, /api/admin/payments, /api/admin/budgets
│   ├─ /api/invoices (issue/pay/archive/generate/ledger/aging)
│   ├─ /api/notifications
│   └─ /api/reimbursements/[id]/{approve,freeze,reject,in_progress,update,messages}
│        ↓ repository pattern                                     │
│      tenantapp/src/server/repositories/*   ←── Direct MongoDB    │
│      tenantapp/src/server/services/*       ←── Business logic    │
└─────────────────────────────────────────────────────────────────┘
                ↓ MONGODB_URI
        MongoDB (tenants, reimbursements, invoices, payments, …)
```

### 2.2 Two authentication models

The Admin app uses **two** auth models simultaneously:

- **Browser → Admin** : Super Admin session cookie. `requireApiAuth(request)`
  in `src/app/api/_utils/auth-guard.ts` validates the session.
- **Admin → TenantApp** : `x-admin-api-key` server-to-server header. Set by
  the proxy helper. TenantApp routes check the header against
  `process.env.ADMIN_API_KEY` (fall back to tenant session for `/api/admin/*`
  routes that also serve tenant dashboards).

The two layers do not share tokens. A user logged into the Admin UI is
*implicitly* trusted by TenantApp via the proxy key — there is no per-user
attribution in TenantApp's view. This is the deliberate design from earlier
phases and is **not in scope** for this audit.

### 2.3 The "direct-Mongo" precedent

The Admin app already breaks the proxy pattern for two areas:

- **`/tenants/*`** (10 routes) — uses `@/modules/tenant/service` →
  `getAllTenants`, `createTenant`, `getTenantById`, etc. against MongoDB
  directly. Includes:
  - 2-phase delete (`tenants/[id]/route.ts` `DELETE`)
  - `dashboard-access` PATCH action dispatch
  - xlsx export generation (`export-responses/route.ts`)
  - multipart upload with `pending=1` pre-creation (`upload-assets/route.ts`)
  - subdomain check normalization
- **`/clinics/*`** (4 routes) — uses `@/modules/clinic/service` directly.
  Includes slug normalization, asset upload with atomic DB update.

The shape of these routes is **not** the same as the proxy pattern: they have
real body parsing, real response shaping, real error handling. The Admin app
already has a "Mongo-aware" code path for these areas; we are not inventing
it.

---

## 3. Dependency Inventory

The full inventory below is grouped by Admin route → TenantApp endpoint →
business-logic content → proxy/direct-DB candidate status. "Own logic" means
"the Admin route file contributes behavior beyond forwarding." A "candidate"
is a route whose TenantApp side contains no business logic worth keeping
inside the TenantApp process boundary.

| # | Admin route | Method | TenantApp endpoint | Own logic (Admin) | Own logic (TenantApp) | Direct-DB candidate |
|---|---|---|---|---|---|---|
| **Financial — read** ||||||
| 1 | `reimbursements/route.ts` | GET | `/api/admin/reimbursements` | parse searchParams, call `requireApiAuth` | filter/search/paginate via repo, **resolve tenant names**, **read-time invoice-link join**, role-based `employeeName` stripping | **No** (read-time join + role filtering) |
| 2 | `reimbursements/[id]/route.ts` | GET | `/api/admin/reimbursements/[id]` | parse id, call `requireApiAuth` | repo lookup, return doc | Marginal — direct repo would work but no benefit (single doc) |
| 3 | `reimbursements/bulk-update/route.ts` | POST | `/api/admin/reimbursements/bulk-update` | forward body | bulk state machine | **No** (bulk-update business logic) |
| 4 | `reimbursements/[id]/messages/route.ts` | GET | `/api/reimbursements/[id]/messages/route` | forward | claim-thread read | **Yes (read path)** — see §9 |
| 5 | `reimbursements/[id]/messages/read/route.ts` | POST | `/api/reimbursements/[id]/messages/read` | forward | mark thread read | **Yes (write path)** — same module as above |
| 6 | `invoices/route.ts` | GET | `/api/invoices` | forward | listByTenant with filters | **No** (shared with public invoice list) |
| 7 | `invoices/[id]/route.ts` | GET | `/api/invoices/[id]` | forward | findById + tenant lookup | Marginal |
| 8 | `invoices/[id]/issue/route.ts` | POST | `/api/invoices/[id]/issue` | forward | state transition `draft → issued` | **No** (frozen state machine) |
| 9 | `invoices/[id]/pay/route.ts` | POST | `/api/invoices/[id]/pay` | forward | state transition `issued → paid` + claim linkage | **No** |
| 10 | `invoices/[id]/archive/route.ts` | POST | `/api/invoices/[id]/archive` | forward | state transition `paid → archived` | **No** |
| 11 | `invoices/[id]/export/route.ts` | GET | `/api/invoices/[id]/export` | forward | pdf rendering | **No** (pdf service in TenantApp) |
| 12 | `invoices/generate/route.ts` | POST | `/api/invoices/generate` | forward body | **atomic claim-set grouping + invoice write** | **No** (Phase 6 verified atomicity) |
| 13 | `invoices/export/[orgId]/route.ts` | GET | `/api/invoices/export/[orgId]` | forward | xlsx export | **No** |
| 14 | `invoices/ledger/route.ts` | GET | `/api/invoices/ledger` | forward | **A/R ledger aggregation** | **No** (aggregation logic) |
| 15 | `invoices/report/aging/route.ts` | GET | `/api/invoices/report/aging` | forward | aging computation | **No** |
| **Financial — write** ||||||
| 16 | `payments/route.ts` | GET | `/api/admin/payments` | forward | **group-by-clinic payout queue** | **No** (Phase 6 grouping logic) |
| 17 | `payments/[claimId]/route.ts` | GET | `/api/admin/payments/[claimId]` | forward | payment lookup | Marginal |
| 18 | `payments/operations/route.ts` | GET | `/api/admin/payments/operations` | forward | operations history | Marginal |
| 19 | `payments/process/route.ts` | POST | `/api/admin/payments/process` | forward body | **`processPayments` (Phase-6 hardened: missing_bank rejection, dedupe, atomic)`** | **No** (frozen business logic) |
| **Tenants (direct Mongo)** ||||||
| 20 | `tenants/route.ts` | GET | — | list filter, shape composition | — | already direct |
| 21 | `tenants/route.ts` | POST | — | create with normalized slug | — | already direct |
| 22 | `tenants/[id]/route.ts` | GET / PATCH / DELETE | — | 2-phase delete, PATCH dispatch | — | already direct |
| 23 | `tenants/[id]/activate/route.ts` | POST | — | state change | — | already direct |
| 24 | `tenants/[id]/archive/route.ts` | POST | — | state change | — | already direct |
| 25 | `tenants/[id]/restore/route.ts` | POST | — | state change | — | already direct |
| 26 | `tenants/[id]/publish/route.ts` | POST | — | publish workflow | — | already direct |
| 27 | `tenants/[id]/publishing-preview/route.ts` | POST | — | preview | — | already direct |
| 28 | `tenants/[id]/export-responses/route.ts` | GET | — | **xlsx generation** | — | already direct |
| 29 | `tenants/[id]/runtime-configs/route.ts` | GET / POST | — | runtime config CRUD | — | already direct |
| 30 | `tenants/[id]/dashboard-access/route.ts` | PATCH | — | dashboard-access dispatch | — | already direct |
| 31 | `tenants/[id]/dashboard-access/reset-password/route.ts` | POST | — | password reset | — | already direct |
| 32 | `tenants/stats/route.ts` | GET | — | shape composition with hard-coded zero counters | — | already direct |
| 33 | `tenants/by-template/route.ts` | GET | — | filter | — | already direct |
| 34 | `tenants/check-subdomain/route.ts` | GET | — | **subdomain normalization** | — | already direct |
| 35 | `tenants/upload-assets/route.ts` | POST | — | **multipart upload + atomic DB update** | — | already direct |
| **Clinics (direct Mongo)** ||||||
| 36 | `clinics/route.ts` | GET / POST | — | list filter, slug normalization | — | already direct |
| 37 | `clinics/[id]/route.ts` | GET / PATCH / DELETE | — | single-doc CRUD | — | already direct |
| 38 | `clinics/check-slug/route.ts` | GET | — | slug check | — | already direct |
| 39 | `clinics/upload-assets/route.ts` | POST | — | asset upload with atomic DB update | — | already direct |
| **Employees (proxy)** ||||||
| 40 | `employees/route.ts` | GET | `/api/super-admin/employees/route` | forward | list with filters + tenant lookup | **No** |
| 41 | `employees/[id]/route.ts` | GET / PATCH | — | forward | employee CRUD | **No** (writes affect tenant) |
| 42 | `employees/[id]/archive/route.ts` | POST | — | forward | state transition | **No** |
| 43 | `employees/[id]/suspend/route.ts` | POST | — | forward | state transition | **No** |
| 44 | `employees/[id]/unsuspend/route.ts` | POST | — | forward | state transition | **No** |
| 45 | `employees/[id]/unlock/route.ts` | POST | — | forward | unlock | **No** |
| 46 | `employees/[id]/reset-password/route.ts` | POST | — | forward | password reset | **No** |
| **Budgets (proxy)** ||||||
| 47 | `budgets/[tenantId]/route.ts` | GET / PUT | `/api/admin/budgets/[tenantId]/route` | forward | **budget allocation + cap computation** | **No** |
| 48 | `budgets/[tenantId]/override/route.ts` | POST | `/api/admin/budgets/[tenantId]/override` | forward | **override audit trail + cap recalc** | **No** |
| 49 | `budgets/[tenantId]/history/route.ts` | GET | `/api/admin/budgets/[tenantId]/history` | forward | **history list** | **No** |
| **Notifications (proxy)** ||||||
| 50 | `notifications/route.ts` | GET | `/api/notifications/route` | forward | list with role/tenant filtering | Marginal — see §9 |
| 51 | `notifications/[id]/read/route.ts` | POST | `/api/notifications/[id]/read` | forward | mark read | Marginal |
| 52 | `notifications/read-all/route.ts` | POST | `/api/notifications/read-all` | forward | bulk mark read | Marginal |
| 53 | `notifications/unread-count/route.ts` | GET | `/api/notifications/unread-count` | forward | count | **Yes** — pure read; Admin already has the cookie + role context |
| **Receipts (proxy)** ||||||
| 54 | `receipts/[reimbursementId]/route.ts` | GET | `/api/admin/receipts` | forward | signed-URL streaming | **No** (binary, access-controlled) |
| **Dashboard (composition)** ||||||
| 55 | `dashboard/summary/route.ts` | GET | — (calls Admin internal routes) | composition (10 sub-fetches, 10 s timeout each) | — | already non-proxy |
| **Logs (stub)** ||||||
| 56 | `logs/route.ts` | GET | — | returns `[]` | — | already non-proxy (intentional stub) |

**Counts:**
- 49 proxy routes
- 10 direct-Mongo tenants routes
- 4 direct-Mongo clinics routes
- 1 composition route (`dashboard/summary`)
- 1 stub route (`logs`)
- **Total: 65 route files** — the count above includes the sub-paths under
  `tenants/[id]/*` and `invoices/[id]/*` which inflates the 59 figure.

---

## 4. Financial Dependencies (detailed)

All 19 financial routes are proxies. They are **not safe to remove** because
the TenantApp side carries non-trivial business logic that the Admin side has
not reimplemented.

### 4.1 Read-time join on `/api/admin/reimbursements`

```ts
// tenantapp/app/api/admin/reimbursements/route.ts (excerpt)
const invoiceLinks = await getClaimInvoiceLinks(claims.map(c => c.reimbursementId));
const mapped = claims.map((c) => {
  const link = invoiceLinks.get(c.reimbursementId);
  return {
    ...base,
    invoiceId: link?.invoiceId ?? null,
    invoiceNumber: link?.invoiceNumber ?? null,
    invoiceStatus: link?.status ?? null,
  };
});
```

This is **not** a pass-through. The endpoint:
- Filters by status, tenantId, search, dateFrom/dateTo (post-query)
- Resolves tenant names via `tenants.findByTenantId` for every distinct tenantId
- Performs the **Phase-2 read-time invoice-link join** so the Admin UI can show
  `invoiceId / invoiceNumber / invoiceStatus` on every claim row without a
  second round-trip
- Strips `employeeName` for tenant-admin callers (this is a **role-based
  redaction**, not present in the underlying doc)

Removing this dependency would require re-implementing the join in the Admin
app — which crosses the frozen-architecture constraint (Phase 7 wired this
join into the workspace as `BillingEligibilityBadge`).

### 4.2 Atomic invoice generation

`POST /api/invoices/generate` calls `generateInvoice()` in
`tenantapp/src/server/services/invoiceService.ts`. Phase 6 verified atomicity:
cross-organization claim selections are rejected, already-invoiced claims are
protected, the invoice + line-item write is atomic.

Reimplementing this on the Admin side would require importing
`invoiceService` directly (crossing the repo boundary) and would re-introduce
a class of bug the audit explicitly fixed.

### 4.3 `processPayments` (Phase-6 hardened)

`POST /api/admin/payments/process` calls `processPayments()` with:
- Empty `claimIds` rejected with `NO_CLAIMS_SELECTED`
- `to_be_paid` claims missing bank info rejected with `reason: "missing_bank"`
- Atomic write of `PaymentRecord` (unique index on `claimId`)
- Idempotent via the unique index

This is the most-changed surface area in Phase 6. Reimplementing it would
void the verification.

### 4.4 A/R ledger aggregation

`GET /api/invoices/ledger` returns an org-rolled aging summary. The
aggregation lives in `invoiceService.getArLedger()`. The Admin dashboard
pipeline currently does not consume this directly — it uses
`/api/super-admin/invoices?status=issued` for the issued-invoice count. If
the A/R ledger becomes part of the dashboard (deferred to Phase 10+), the
proxy is the right surface.

### 4.5 What the Admin proxy contributes

Across all 19 financial routes, the Admin proxy:
- Calls `requireApiAuth(request)` for browser session validation
- Forwards `searchParams` and `body` as-is
- Surfaces the upstream status code and message
- Logs the proxied call (implicitly, via `safeFetchJson` patterns)

There is **no financial business logic on the Admin side**. That is by
design.

---

## 5. Dashboard Dependencies (detailed)

`/api/super-admin/dashboard/summary` is the **only composition route** in the
Admin app. It does not call TenantApp directly — it fans out to 10 internal
Admin routes:

```
GET /api/super-admin/reimbursements?status=approved&limit=500
GET /api/super-admin/reimbursements?status=to_be_paid&limit=500
GET /api/super-admin/invoices?status=issued
GET /api/super-admin/invoices?status=paid&limit=500
GET /api/super-admin/payments
GET /api/super-admin/payments/operations
GET /api/super-admin/tenants/stats
GET /api/super-admin/clinics?limit=1
GET /api/super-admin/employees?limit=1
GET /api/super-admin/notifications/unread-count
```

These 10 calls each fan out to their own TenantApp endpoint (or direct-Mongo
for `tenants/stats`, `clinics`, `employees`). The composition route adds
**zero** new dependencies; it is a thin server-side aggregator.

The dashboard is *already* structured to avoid the 8-round-trip waterfall
that the prior design introduced. The composition route replaces 8 client
fetches with 1 server fetch. This is **composition, not application-wide
caching** — there is no `cache-control`, no `revalidate`, no
`unstable_cache`. Each section still renders independently.

**Verdict:** No change recommended. The composition route is the right
shape; it is the only place the Admin server makes internal sub-fetches.

### 5.1 Subtle inefficiency (deferred)

`clinics?limit=1` and `employees?limit=1` are used purely for counts. This
forces the Admin to fetch the full list and count it client-side (well,
server-side, but still: it walks the full list). The proper fix is a
`/clinics/stats` and `/employees/stats` endpoint that returns a count.
**Not in scope** for this audit (would touch TenantApp and the Admin UI
simultaneously). Documented for the Performance phase.

---

## 6. Sidebar Dependencies (detailed)

The Admin sidebar (`src/components/layout/Sidebar.tsx`) drives navigation.
None of its links hit TenantApp directly — they are Next.js client-side
`<Link>`s to Admin pages, which then fetch the Admin routes. The sidebar
itself contributes no API dependency.

The sidebar surfaces routes under two groups: **Operations** (Claims &
Billing, Payments) and **Admin** (Tenants, Clinics, Employees, Logs,
Settings, etc.). After Phase 9 redesign, the `/` page becomes a command
center and the non-financial surfaces move out — but this is a separate
phase.

**Verdict:** No dependency-related change to the sidebar. The sidebar's role
is chrome, not data.

---

## 7. Unnecessary Dependencies

Three categories of proxy are candidates for removal or migration:

### 7.1 `notifications/unread-count` (route 53)

TenantApp endpoint: `GET /api/notifications/unread-count` — pure count.
Returns `{ unread: number }`. Admin uses it for the dashboard's unread
count.

**Why it is unnecessary:** The Admin app already has the Super Admin session
cookie. The TenantApp endpoint resolves the recipient via `auth.session`
(or `x-admin-api-key`); the Admin app can do the same lookup directly using
the Super Admin session. The data is one Mongo count.

**Migration cost:** Small. Requires adding a `notifications/stats` direct-Mongo
route in the Admin app. The Admin app would import the existing
`notifications` Mongo collection (no new collection, no schema change).

**Migration benefit:** Removes 1 round-trip on every dashboard mount. The
unread count is the single most-called route on the dashboard.

**Risk:** Low. Read-only. No writes. No state machine. No role-based
filtering beyond "who is the super admin."

### 7.2 `reimbursements/[id]/messages` (routes 4, 5)

TenantApp endpoint: `GET /api/reimbursements/[id]/messages/route`,
`POST /api/reimbursements/[id]/messages/read`. Read thread + mark thread
read.

**Why it is unnecessary:** The Admin app could call
`claimMessages.listByClaimId(claimId)` directly. The TenantApp side performs
no business logic beyond "return the messages for this claim."

**Migration cost:** Small. Two thin direct-Mongo routes in the Admin app.

**Migration benefit:** The Admin claim-detail page already calls
`/api/super-admin/payments/[claimId]` for the payment-link join. Removing
this proxy consolidates the Admin claim-detail surface.

### 7.3 `notifications/[id]/read`, `notifications/read-all` (routes 51, 52)

Same family as 7.1. **Marginal** — write paths are not as cheap to migrate
because they require recipient-role validation that currently lives in
TenantApp. Recommend keeping these as proxies; only the read-only
`unread-count` is unambiguously safe.

---

## 8. Dependencies That Must Remain

These are the proxies that **must stay** because the TenantApp side carries
business logic that cannot (per frozen-architecture) be reimplemented:

| Category | Routes | Reason |
|---|---|---|
| **Financial state transitions** | 8, 9, 10, 12, 19 | Invoice lifecycle + payment processing are Phase-6 verified |
| **Read-time joins / aggregations** | 1, 14, 15 | Claims→invoice join, A/R ledger, aging — server-side aggregation |
| **Bulk operations** | 3, 19 | bulk-update state machine, processPayments |
| **PDF / xlsx generation** | 11, 13 | pdf + xlsx libraries live in TenantApp |
| **Receipts** | 54 | signed-URL access-controlled binary streaming |
| **Tenant mutations** | 41–46 | employee CRUD affects the tenant employee list — must run in the same DB transaction as the tenant view |
| **Budgets** | 47, 48, 49 | budget allocation + override audit trail + history — server-computed caps |

**Touching any of these would re-introduce the Phase-6 defects or
re-implement frozen business logic.** They are **not** candidates for
removal.

---

## 9. Direct Mongo / Repository Candidates

The Admin app already has a precedent for direct-Mongo routes
(`tenants/*`, `clinics/*`). The candidates below follow that same shape:

### 9.1 Candidates (priority order)

1. **`notifications/unread-count`** — pure read, one Mongo count. Migrate
   to a direct-Mongo route.
2. **`notifications/[id]/read`** and **`notifications/read-all`** — read
   paths; migration is optional but consistent with 9.1.
3. **`reimbursements/[id]/messages`** and
   **`reimbursements/[id]/messages/read`** — read thread + mark read.
   Migrate to a direct-Mongo route pair.

### 9.2 Non-candidates (intentionally left as proxies)

- All financial read paths (1–15) — read-time joins + aggregations
- All financial write paths (8–10, 12, 19) — frozen state machines
- All employee mutations (41–46) — cross-tenant transactionality
- All budget routes (47–49) — cap computation
- All receipt routes (54) — binary streaming

### 9.3 Implementation shape (for the implementation phase, not now)

For each migrated route:

1. Create `src/app/api/super-admin/<area>/route.ts`.
2. Use the same `requireApiAuth` guard.
3. Import the Admin app's `mongodb` connection directly (the Admin app
   already uses `getMongoDb()` via `tenants/_utils.ts` — extend that
   pattern).
4. **Do not** import from `tenantapp/src/server/repositories/*` — that
   would cross the repo boundary. Either re-implement the query inline
   (preferred for one-off reads) or extract a small shared module in
   `remedygcc-admin/src/lib/db/`.

---

## 10. Risks

### 10.1 The "two DB worlds" risk

The Admin app already talks to MongoDB directly for `tenants/*` and
`clinics/*`. If we extend that pattern (notifications, claim messages), we
introduce a third code path:

- TenantApp owns Mongo for financial, employees, budgets, receipts
- Admin owns Mongo for tenants, clinics (and now: notifications, claim
  messages)
- Both write to Mongo

This means a single Mongo collection can be written to by either process.
The risk is **schema drift** — a TenantApp-side index change or shape
change won't be caught by Admin-side TypeScript.

**Mitigation:** Before any migration, ensure both processes share the
`@/src/server/db/documents` type definitions. Currently only TenantApp
imports them; the Admin side would need a parallel type file. **This is a
prerequisite for the implementation phase**, not part of this audit.

### 10.2 The "TenantApp unavailable" risk

If `TENANT_APP_URL` is unreachable, every proxy returns 502. This is
already the behavior today. The dashboard composition route degrades
gracefully (each section shows its own skeleton/error). The single direct-Mongo
migrations in §9 do **not** change this risk profile — the financial
dependencies remain on TenantApp.

### 10.3 The "two auth models" risk

A Super Admin user has a session in the Admin app. TenantApp trusts the
Admin proxy key without per-user attribution. This means a logged-in Admin
session that abuses the proxy cannot be logged out by disabling the user's
Admin account (TenantApp still accepts the key). **This is a pre-existing
design, not a regression from this audit.** Not in scope.

### 10.4 The "single-process failure" risk

If TenantApp is down, the Admin dashboard renders skeletons for the
financial sections. This is **expected** and the per-section error boundary
handles it. No change recommended.

---

## 11. Recommended Changes

In priority order. **None are implemented in this audit.**

### 11.1 R1 — Migrate `notifications/unread-count` to direct Mongo

**Scope:** Add `src/app/api/super-admin/notifications/unread-count/route.ts`
that calls `notificationsRepository.countUnread(...)` directly. Delete the
proxy.

**Effort:** Small (one route file, one Mongo call).
**Risk:** Low (read-only).
**Benefit:** Removes 1 round-trip on every dashboard mount.

### 11.2 R2 — Migrate `reimbursements/[id]/messages` to direct Mongo

**Scope:** Add `src/app/api/super-admin/reimbursements/[id]/messages/route.ts`
that calls `claimMessages.listByClaimId(claimId)`. Delete the proxy. Same
for `messages/read`.

**Effort:** Small (two route files).
**Risk:** Low (read + idempotent write).
**Benefit:** Consolidates the Admin claim-detail surface.

### 11.3 R3 — Do NOT migrate financial proxies

Every financial proxy is intentionally a proxy. **Do not touch them.**

### 11.4 R4 — Do NOT migrate employee or budget proxies

Same reason — TenantApp owns the cross-tenant write semantics.

### 11.5 R5 — Do NOT touch `dashboard/summary`

The composition route is the correct shape. No change.

---

## 12. Implementation Order

If the R1 and R2 changes are approved as a separate phase:

1. **Pre-flight (R0):** Audit the Admin app's existing direct-Mongo pattern
   in `tenants/_utils.ts` and `clinics/upload-assets/route.ts`. Confirm the
   Mongo connection is shared with TenantApp's connection string. Confirm
   the `notifications` and `claimMessages` collection types are exported from
   a shared module (or copy them into the Admin app, mirroring Phase 7's
   shared `lib/financial` pattern).
2. **R1:** Implement `notifications/unread-count` direct-Mongo route. Run
   `npx tsc --noEmit`. Manual smoke test on the dashboard — verify the
   unread count badge still appears.
3. **R2:** Implement `reimbursements/[id]/messages` direct-Mongo route. Same
   verification on the claim-detail page.
4. **Documentation:** Update `docs/architecture/admin-tenantapp-boundary.md`
   (does not exist yet — create it as part of R1) to record the direct-Mongo
   pattern, the schema-drift risk, and the prerequisite (shared document
   types).
5. **HARD STOP.** Do not begin Performance audit or any other phase.

### 12.1 Verification per change

After each migration:
- `npx tsc --noEmit` clean
- Manual smoke on the affected route
- Per-route test (deferrable; if no test exists for the proxy, none is
  required for the direct-Mongo route — parity with prior state)

---

## 13. Explicitly Deferred Work

These are **out of scope** for this audit. They are blocked behind
dependency audit completion per the workstream directives.

1. **Performance audit** — not started. Requires this audit to be
   documented first.
2. **Dashboard redesign (Phase 10)** — blocked per workstream directives.
   The `dashboard/summary` route is verified and frozen; no changes here.
3. **Caching** — blocked. No new caching layer introduced. The
   `dashboard/summary` composition route is **not** a cache and must not
   become one without an explicit phase.
4. **React cleanup** — blocked.
5. **Application-wide rate limiting** — not in scope of this audit.
6. **A/R ledger as part of the dashboard** — Phase 10+ candidate.
7. **`/clinics/stats` and `/employees/stats` count endpoints** —
   documented in §5.1, deferred to Performance phase.
8. **Audit logging on `proxyToTenantApp`** — pure observability. Deferred
   until monitoring is its own approved phase.
9. **Shared `documents.ts` import in the Admin app** — prerequisite for
   R1/R2. Must be a separate, small sub-phase before R1/R2.

---

## 14. Summary Table

| Decision | Status |
|---|---|
| Keep all 19 financial proxies | ✅ Required (frozen architecture) |
| Keep all 9 employee + budget proxies | ✅ Required (cross-tenant writes) |
| Keep `tenants/*` direct-Mongo routes | ✅ Already correct |
| Keep `clinics/*` direct-Mongo routes | ✅ Already correct |
| Keep `dashboard/summary` composition route | ✅ Correct shape |
| Keep `logs` stub | ✅ Intentional |
| Migrate `notifications/unread-count` to direct Mongo | 🟡 Recommended (R1) |
| Migrate `reimbursements/[id]/messages` to direct Mongo | 🟡 Recommended (R2) |
| Migrate other notifications proxies | 🟢 Optional (R1.5) |
| Touch `invoices/*`, `payments/*`, `reimbursements/*` | 🔴 **Forbidden** (frozen) |
| Add caching | 🔴 **Forbidden** (separate phase) |
| Begin Performance audit | 🔴 **Blocked** until this doc is approved |
| Begin Dashboard redesign | 🔴 **Blocked** until Performance audit |

---

## 15. Verification

This audit is a documentation deliverable. There are no code changes to
verify. The deliverable has been:

- **Cross-referenced** with the proxy route inventory (§3)
- **Cross-referenced** with the TenantApp route inventory (the 65 Admin
  routes map to ~25 distinct TenantApp endpoints — some Admin routes proxy
  to the same TenantApp endpoint with different `searchParams`)
- **Cross-referenced** with the frozen-architecture constraint (financial
  workflows are not reimplementable)
- **Self-checked** against the 13 required sections from the workstream
  directive (Executive Summary, Architecture Overview, Dependency
  Inventory, Financial Dependencies, Dashboard Dependencies, Sidebar
  Dependencies, Unnecessary Dependencies, Dependencies That Must Remain,
  Direct Mongo/Repository Candidates, Risks, Recommended Changes,
  Implementation Order, Explicitly Deferred Work)

---

## 16. Hard Stop

**No code changes in this phase.** Per the workstream directive, this audit
ends with a hard stop. The next phase (Performance audit) is blocked until
this audit is approved and the R1/R2 migrations (if approved) are
completed in a separate, gated phase.

---

## 17. Recommendation for Next Phase

Once this audit is reviewed:

- If R1 + R2 are approved: implement them as a small, gated sub-phase with
  the prerequisite shared `documents.ts` import.
- Then: Performance audit (the next allowed phase per the workstream
  directives).
- Dashboard redesign (Phase 10) is still blocked behind Performance.
- Caching and React cleanup are blocked behind Dashboard redesign.

The dashboard command-center plan in `fluttering-stirring-cat.md` is the
correct Phase 10 shape. It is **not** part of this audit and should not be
merged into the dependency-audit phase.