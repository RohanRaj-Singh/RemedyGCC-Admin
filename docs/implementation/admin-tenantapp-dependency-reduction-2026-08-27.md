# Admin → TenantApp Proxy Dependency Reduction — 2026-08-27

## Objective

Remove three unnecessary Admin → TenantApp round-trips that exist only to
proxy simple read / mark-read operations against collections that the Admin
app's `MONGODB_URI` already shares with the Tenant App (`mongodb://localhost:27017/tenantapp`).
The Admin app is not being turned into a duplicate of the Tenant App: only
operations that **do not depend on tenant-side business logic** are
re-targeted to the shared Mongo instance.

This phase is the smallest possible step that achieves an immediate,
measurable reduction in cross-process traffic for three routes that were
pure pass-through.

---

## Scope (exactly three routes)

| Route | Method | Kind | Phase |
|---|---|---|---|
| `/api/super-admin/notifications/unread-count` | GET | count | R1 |
| `/api/super-admin/reimbursements/:id/messages` | GET | list + count | R2 |
| `/api/super-admin/reimbursements/:id/messages/read` | POST | idempotent update | R2 |

Every other Admin route that proxies to the Tenant App remains on the
proxy. In particular, **all financial routes stay on the proxy** and the
CLAIM → INVOICE → ORGANIZATION PAYMENT → TO_BE_PAID → PAYMENT → PAID state
machine is untouched. See "Out of Scope" below.

---

## Architectural Objective (and what it is NOT)

**What this is:**

- A targeted, route-by-route elimination of pass-through proxies for
  operations that are pure reads or idempotent reads against Mongo
  collections that are already shared by both processes.
- A direct use of `runMongoScript<T>` from `@/server/mongo-shell` — the
  same primitive Admin uses for the response repository and scanner
  repository. No new infrastructure, no new connection, no new collection,
  no new ORM, no caching.

**What this is NOT:**

- An attempt to reimplement the Tenant App's financial services in Admin.
- An attempt to add an Admin-side write surface for claims, invoices, or
  payments.
- A caching layer. There is no cache here. Every migrated request still
  hits Mongo on every call.
- A general "Admin should query Mongo directly" mandate. Only the three
  routes above are migrated, because they are the only routes whose
  Tenant App handlers do not depend on the Tenant App's request context
  (auth identity, tenant scoping, multi-tenant indexing policy, financial
  state machine).

---

## Architectural Primitives Used

### `runMongoScript<T>(scriptBody, payload?, options?)`

- Lives at `src/server/mongo-shell.ts`.
- Spawns `mongosh --quiet --file <tmpfile>` against
  `$MONGODB_URI` (default `mongodb://localhost:27017/tenantapp`).
- Replaces `__payload.<field>` placeholders with sanitized values from the
  supplied `payload` argument (no string interpolation of untrusted input).
- Parses the last non-empty stdout line as JSON, decodes `__emit(value)`
  / `__strip(value)` helpers, and resolves to `T`.
- Accepts an optional debug `label` tag (echoed in `MONGOSH EXEC ERROR`
  logs). Process-level timeout is governed by `execFile`'s default and
  Node's `child_process.exec`-level timeout (no script-level timeout is
  configured; the migrated scripts are short, single-collection reads or
  a single idempotent `updateMany`).

### `requireApiAuth(request)`

- Lives at `src/app/api/_utils/auth-guard.ts`.
- Returns `{ success: true, adminId, adminEmail, adminRole }` on success,
  or `{ success: false, response: NextResponse }` on failure.
- Used as the **first** statement in every migrated handler. The viewer
  identity for both R1 and R2 is derived from the *verified* admin role —
  never from a client-supplied parameter.

### `apiErrorResponse(error, status=400)`

- Lives at `src/app/api/super-admin/tenants/_utils.ts`.
- Uniform error envelope used across all `/api/super-admin/**` routes.

---

## R1 — Notification Unread Count

### Before

- Admin route at `src/app/api/super-admin/notifications/unread-count/route.ts`
  proxied to `${TENANT_APP_URL}/api/notifications/unread-count` with the
  `x-admin-api-key` header.
- Tenant App handler computed the count by calling
  `notificationsRepository.unreadCountForSuperAdmin()`.

### After

- The same Admin route now runs a single Mongo script:

```js
db.notifications.countDocuments({
  tenantId: "",
  recipientType: "superAdmin",
  recipientId: "super-admin",
  read: false,
});
```

### Identity & Authorization

- `requireApiAuth(request)` enforces an authenticated admin session.
- If `adminRole !== "superAdmin"`, the request is rejected with HTTP 403
  ("Forbidden.").
- The filter values (`tenantId`, `recipientType`, `recipientId`) come from
  the **canonical Super Admin identity constants** baked into the script.
  They are **never** read from the URL or body.

### Response Contract

Preserved exactly:

```json
{ "count": 0 }
```

HTTP 200 on success; HTTP 401/403 on auth failure; HTTP 500 on Mongo
failure.

### Index Coverage

The query is fully covered by the existing index
`notifications.notification_recipient`
`{ tenantId: 1, recipientType: 1, recipientId: 1, read: 1 }` (created
by `NotificationsRepository.ensureIndexes()` in the Tenant App).
No new index is added.

### Consumers

The only consumer of this endpoint is the Super Admin Dashboard
`summary` route, which already tolerates either `{ count }` or `{ unread }`
in its response shape. `NotificationBell.tsx` does **not** consume this
endpoint — it reads both items and unread count from
`/api/super-admin/notifications?limit=20`.

---

## R2 — Claim Chat Messages (GET)

### Before

- Admin route at `src/app/api/super-admin/reimbursements/:id/messages/route.ts`
  proxied to `${TENANT_APP_URL}/api/reimbursements/:id/messages`.

### After

The route runs a single Mongo script that:

1. **Verifies the claim exists** by `reimbursementId === params.id`,
   with **no `tenantId` filter**. The Super Admin is platform-wide and is
   not bound to a tenant. Filtering by `tenantId` here would be incorrect
   and is **explicitly forbidden** by the migration directive.
2. Returns HTTP 404 (`{ error: "Claim not found." }`) when the claim does
   not exist.
3. Fetches messages with the projection `{ _id: 0 }`, sorted
   `{ createdAt: -1 }`, limit 200, then reverses in-JS to deliver
   chronological (ASC) order. This matches the Tenant App repository
   contract (`ClaimMessagesRepository.listByClaimId` returns the same
   shape — fetch DESC, reverse ASC).
4. Computes the unread count with the same filter shape as the Tenant
   App repository (`participant.key` not equal to viewer AND
   `readBy` not containing viewer).

### Identity & Authorization

- `requireApiAuth(request)` enforces an authenticated admin session.
- The viewer key for unread counting is the canonical Super Admin key
  `"superAdmin:super-admin"` — derived server-side, never from the request.

### Response Contract

Preserved exactly:

```json
{
  "messages": [ ... ClaimMessageDocument[] (chronological) ],
  "unreadCount": 3
}
```

HTTP 200 on success; HTTP 404 on missing claim; HTTP 401 on auth failure;
HTTP 500 on Mongo failure.

### Index Coverage

- The messages query is fully covered by the existing index
  `claimMessages.claim_message_claim_created`
  `{ claimId: 1, createdAt: 1 }`.
- The unread count query benefits from
  `claimMessages.claim_message_claim_author`
  `{ claimId: 1, "participant.key": 1 }`.
- No new index is added.

---

## R2 — Mark Claim Chat Thread Read (POST)

### Before

- Admin route at `src/app/api/super-admin/reimbursements/:id/messages/read/route.ts`
  proxied to `${TENANT_APP_URL}/api/reimbursements/:id/messages/read`.

### After

The route runs a single Mongo script that:

1. **Verifies the claim exists** (same `reimbursementId` check, no
   `tenantId` filter, 404 if missing — same rule as the GET endpoint).
2. Calls `db.claimMessages.updateMany` with the same filter shape used
   by `ClaimMessagesRepository.markThreadRead` and applies
   `$addToSet: { readBy: viewerKey }`.
3. Returns the **modified count** (number of messages newly marked as
   read by this viewer).

### Idempotency

`$addToSet` is a no-op when the value is already present in the array.
On the second call from the same viewer, `modifiedCount` drops to 0.
This matches the Tenant App repository's idempotency guarantee.

### Identity & Authorization

- `requireApiAuth(request)` enforces an authenticated admin session.
- The viewer key is the canonical Super Admin key
  `"superAdmin:super-admin"` — derived server-side.

### Response Contract

Preserved exactly:

```json
{ "count": 4 }
```

HTTP 200 on success; HTTP 404 on missing claim; HTTP 401 on auth failure;
HTTP 500 on Mongo failure.

### Index Coverage

Same two existing claim-message indexes cover the update filter and the
existence check. No new index is added.

---

## What Did NOT Change

- All financial routes still proxy to the Tenant App:
  reimbursements list/detail/bulk-update, invoice generation,
  invoice issue/pay/archive/export, A/R ledger, payments, payment
  processing. The financial state machine remains authoritative in the
  Tenant App.
- The Tenant App's claim messages and notifications route handlers are
  untouched. They remain in place because:
  - The Tenant App's claim-chat POST endpoints still have non-Admin
    consumers (employees, clinic admins, tenant admins).
  - The Tenant App's notifications endpoint still serves the in-app
    notification dropdown for tenants.
- The `NotificationBell.tsx` component continues to read its items from
  `/api/super-admin/notifications?limit=20`.
- `useDashboardSummary.ts` continues to consume the unread-count
  endpoint, with `{ unread }` or `{ count }` both accepted.
- No new index, no new collection, no new connection, no new ORM, no new
  caching layer. The change is purely "where the SQL-equivalent runs":
  in the Admin process against shared Mongo, instead of inside the
  Tenant App's Node process.

---

## Schema Compatibility

All three migrated routes read from collections whose document shapes are
defined in `tenantapp/src/server/db/documents.ts`:

| Collection | Field(s) used | Notes |
|---|---|---|
| `notifications` | `tenantId`, `recipientType`, `recipientId`, `read` | All string-typed. Missing fields would fail the equality check, which is the correct behavior — the canonical Super Admin identity is a fixed tuple. |
| `reimbursements` | `reimbursementId` | Used only for the existence check; no other field is read. |
| `claimMessages` | `claimId`, `createdAt`, `participant.key`, `readBy` | `participant` is an embedded object with a string `key` field; `readBy` is a `string[]`; `createdAt` is the standard sortable ISO field. |

Legacy documents missing any of the expected fields would simply be
excluded from the result set, which is the same behavior the Tenant App
repository exhibits.

---

## Response Compatibility

Every migrated route was diffed against the corresponding Tenant App
handler before migration:

| Route | Upstream response shape | Admin response shape (preserved) |
|---|---|---|
| `/notifications/unread-count` | `{ count: number }` | `{ count: number }` |
| `/reimbursements/:id/messages` | `{ messages: ClaimMessageDocument[], unreadCount: number }` | `{ messages: ClaimMessageDocument[], unreadCount: number }` |
| `/reimbursements/:id/messages/read` | `{ count: number }` | `{ count: number }` |

The only addition is HTTP 404 for the claim-existence failure mode. The
previous proxy translated Tenant App 404s by forwarding the response
verbatim, so Admin callers already expect a 404 with an `error` field.

---

## Testing Performed

- **TypeScript:** `npx tsc --noEmit` runs clean across the admin app.
- **Manual smoke (post-deploy):**
  - Visit `/dashboard` as super admin. Unread count badge in the
    `NotificationBell` still resolves correctly (it does not depend on
    this route, but the Dashboard summary does).
  - Visit `/reimbursements/:id` as super admin. The claim chat thread
    loads, displays messages in chronological order, and shows the
    correct unread count for the Super Admin viewer.
  - Open a new message as a tenant admin in the same thread. The
    Super Admin's unread count increments within a normal refresh.
  - Open the chat thread as super admin; the "mark read" call fires,
    and the unread count returns to 0. Refresh again — count stays at 0
    (idempotency).
  - Visit `/reimbursements/<nonexistent-id>/messages`. Response is
    HTTP 404 `{ error: "Claim not found." }`. The Admin UI surfaces
    this via its existing 404 handling.

---

## Out of Scope (Hard Stop)

Per the locked directive, **none of the following were started**:

1. Migrating any financial route to direct Mongo. Financial routes still
   proxy to the Tenant App. The CLAIM → INVOICE → ORGANIZATION PAYMENT →
   TO_BE_PAID → PAYMENT → PAID state machine is untouched.
2. Reimplementing any Tenant App financial service in Admin.
3. Removing Tenant App endpoints that still serve non-Admin consumers
   (employees, clinic admins, tenant admins).
4. Adding caching (no Redis, no Next cache, no `unstable_cache`, no
   `revalidate`, no SWR, no React Query, no global cache).
5. Performance audit.
6. Dashboard redesign.
7. Caching initiative.
8. React / Next.js cleanup pass.
9. Migrating any additional Admin → Tenant App proxy beyond the three
   listed in §1.

---

## Files Changed

**Modified (3 files):**

- `src/app/api/super-admin/notifications/unread-count/route.ts`
- `src/app/api/super-admin/reimbursements/[id]/messages/route.ts`
- `src/app/api/super-admin/reimbursements/[id]/messages/read/route.ts`

**Created (1 file):**

- `docs/implementation/admin-tenantapp-dependency-reduction-2026-08-27.md`
  (this document)

**Untouched:**

- All financial routes (`/api/super-admin/reimbursements/**`,
  `/api/super-admin/invoices/**`, `/api/super-admin/payments/**`).
- `src/server/mongo-shell.ts` and `src/server/response/repository.ts` —
  these provided the `runMongoScript` primitive and the reference
  pattern. They were not modified; they were *used*.
- All Tenant App source code. The Tenant App handlers behind these
  three routes are unchanged.
- The Dashboard summary route's contract.
- `NotificationBell.tsx` and other consumers of these endpoints.

---

## Rollback

If any of the three migrated routes regresses in production, revert each
file individually to its previous proxy version (preserved in git
history). The Tenant App endpoints and Admin consumers are unchanged, so
the rollback is a no-op for the rest of the system.
