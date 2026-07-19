# Architecture Audit: Claims, Reimbursement & Employees

> **Date:** 2026-07-18  
> **Scope:** `remedygcc-admin`, `remedygcc-marketing`, `tenantapp`  
> **Database:** MongoDB (no Prisma/ORM — raw driver)

---

## 1. Entity Relationship Model

```
Tenant (1) ──< Employee (N)
   │
   └── Reimbursement/Claim (N) ──< ClaimHistoryEntry (N)
         │
         └── Clinic (optional, denormalized ref)
```

### Key Modeling Decisions

| Aspect | Decision |
|--------|----------|
| **Tenant isolation** | All documents carry `tenantId`. Every query filters by it — no cross-tenant leakage by design. |
| **Employee name** | Denormalized into `ReimbursementDocument.employeeName` at claim creation time. Employee renaming does NOT retroactively update claim records. |
| **Clinic ref** | Denormalized `clinicId` + `clinicName` on claim. No dedicated Clinic document model in the current scope. |
| **Claim number** | Auto-generated `RMB-YYYY-NNNNNN` via atomic MongoDB counter — not editable. |
| **No formal FK/relations** | MongoDB — relationships are by convention (`tenantId`, `employeeId` strings). |

---

## 2. Employee Model

### Document Shape (`tenantapp/src/server/db/documents.ts:115`)

| Field | Type | Notes |
|-------|------|-------|
| `employeeId` | `string` | Prefix `emp_` + UUID |
| `tenantId` | `string` | FK to Tenant |
| `employeeCode` | `string` | Unique per tenant (compound unique index) |
| `name` | `string` |  |
| `email` | `string` |  |
| `status` | `"active" \| "inactive"` |  |
| `pinHash` | `string` | scrypt `salt:hash` (never exposed to clients) |
| `failedLoginAttempts` | `number` | Auto-incremented on failed PIN |
| `lockedUntil` | `string \| null` | ISO-8601 lockout timestamp |
| `lastAccessAt` | `string \| null` | ISO-8601 last successful login |

### MongoDB Indexes

```
{ employeeId: 1 }                (unique)
{ tenantId: 1 }                  (non-unique)
{ tenantId: 1, employeeCode: 1 } (unique compound)
{ tenantId: 1, name: 1 }        (non-unique, for search)
```

### Auth Mechanism

- **PIN-based login** with scrypt hashing + constant-time comparison (`timingSafeEqual`)
- **Lockout:** 5 failed attempts → 15-minute lockout (auto-resets after expiry)
- **Session:** Marketing site uses HMAC-signed cookies (`employee_session`, 24h TTL)
- **No roles within employees** — all employees are equal. Differentiation is purely by `status` (active/inactive).

### API Surface

| Method | Route | Action | Role |
|--------|-------|--------|------|
| GET | `/api/employees` | List (search, status filter, pagination) | Tenant Admin |
| POST | `/api/employees` | Create | Tenant Admin |
| GET | `/api/employees/[id]` | Detail + access info | Tenant Admin |
| PUT | `/api/employees/[id]` | Update fields + optional PIN change | Tenant Admin |
| PATCH | `/api/employees/[id]` | Disable (→ inactive) | Tenant Admin |
| POST | `/api/employees/[id]/unlock` | Unlock (clear lockout) | Tenant Admin |
| POST | `/api/employees/[id]/reset-pin` | Reset PIN (returns new 6-digit) | Tenant Admin |
| POST | `/api/employee/login` | PIN login (public) | Employee |
| GET | `/api/employee/tenants` | List active tenants (public) | Public |
| GET | `/api/employee/me` | Profile by slug+code | Employee |

### CRUD Matrix (Employee)

| Operation | Tenant Admin | Employee | Super Admin |
|-----------|:-----------:|:--------:|:-----------:|
| **Create** | ✓ | ✗ | ✗ |
| **Read** (list) | ✓ | ✗ (self only via claims) | ✗ |
| **Read** (detail) | ✓ | ✗ | ✗ |
| **Update** (name/email) | ✓ | ✗ | ✗ |
| **Disable** (status) | ✓ | ✗ | ✗ |
| **Change PIN** | ✓ (set to any via update) | ✗ (returned by admin only) | ✗ |
| **Reset PIN** | ✓ (generates new 6-digit) | ✗ | ✗ |
| **Unlock** | ✓ | ✗ | ✗ |
| **Login** | ✗ | ✓ | ✗ |

---

## 3. Claim / Reimbursement Model

> **Naming note:** The codebase uses "Claim" and "Reimbursement" interchangeably. The MongoDB collection is `reimbursements`, the document type is `ReimbursementDocument`, but all UI and most APIs say "Claims."

### Document Shape (`tenantapp/src/server/db/documents.ts:140`)

| Field | Type | Notes |
|-------|------|-------|
| `reimbursementId` | `string` | Prefix `reimb_` + UUID |
| `claimNumber` | `string?` | Auto-generated `RMB-YYYY-NNNNNN` |
| `tenantId` | `string` | FK to Tenant |
| `employeeId` | `string` | FK to Employee |
| `employeeName` | `string` | Denormalized at creation |
| `type` | `string` | Filled by tenant admin; employee creates get `type: "reimbursement"` |
| `amount` | `number` | Max 999,999,999 |
| `description` | `string` | Max 2000 chars |
| `receiptUrl` | `string?` | Path to uploaded receipt file |
| `receiptHash` | `string?` | SHA-256 of receipt file |
| `serviceDate` | `string?` | YYYY-MM-DD |
| `clinicId` | `string?` | Denormalized clinic slug |
| `clinicName` | `string?` | Denormalized clinic name |
| `status` | `enum` | `pending → approved/rejected/frozen → paid` |
| `reviewedBy` | `string?` | Actor who last reviewed |
| `reviewedAt` | `string?` | ISO-8601 |
| `notes` | `string?` | Admin review notes |
| `history` | `ClaimHistoryEntry[]?` | Append-only audit trail |

### MongoDB Indexes

```
{ reimbursementId: 1 }           (unique)
{ tenantId: 1 }                  (non-unique)
{ tenantId: 1, employeeId: 1 }   (non-unique)
{ tenantId: 1, status: 1 }      (non-unique)
{ tenantId: 1, createdAt: -1 }  (non-unique, for sort)
```

### State Machine

```
    ┌──────────┐
    │  pending │  ← Initial state on creation
    └────┬─────┘
         │
    ┌────┴────┬────────┬─────────┐
    ▼         ▼        ▼         │
 ┌──────┐ ┌──────┐ ┌──────┐     │
 │paid  │ │rejec-│ │frozen│     │
 │(N/A) │ │ted   │ └──┬───┘     │
 └──────┘ └──────┘    │         │
               ▲      ├─────────┘
               │      ▼
               │  ┌──────┐
               └──│appro-│
                  │ved   │
                  └──┬───┘
                     ▼
                  ┌──────┐
                  │ paid │  (terminal)
                  └──────┘
```

- `pending` → mutable by tenant admin (edit)
- `pending` → `approved` / `rejected` / `frozen` (by tenant admin)
- `approved` → `paid` (only valid transition; enforced in service)
- `frozen` → `approved` / `rejected` (tenant admin "thaws")
- `paid` = terminal state (no further transitions)
- `rejected` = editable by employee for resubmission (Phase 2 item, not yet enforced)

### Claim History Entry

```typescript
{
  status: "pending" | "approved" | "rejected" | "frozen" | "paid";
  actorId: string;
  actorRole: "employee" | "tenantAdmin";
  note?: string;
  timestamp: string; // ISO-8601
}
```

### Claim Number Format

```
RMB-YYYY-NNNNNN
  ↑    ↑     ↑
fixed year  6-digit zero-padded atomic sequence
```

### API Surface

#### Employee-Facing (via marketing site → proxy)

| Method | Route | Action | Auth |
|--------|-------|--------|------|
| POST | `/api/employee-access/reimbursements` | Create claim (with receipt upload) | Employee session |
| GET | `/api/employee-access/claims` | List own claims | Employee session |
| GET | `/api/employee-access/claims/[id]` | Get own claim detail | Employee session |
| GET | `/api/employee-access/receipts/[id]` | Stream receipt | Employee session |

#### Tenant Admin (tenantapp)

| Method | Route | Action | Auth |
|--------|-------|--------|------|
| GET | `/api/reimbursements` | List claims (search, filter, paginate) | Tenant session |
| POST | `/api/reimbursements` | Create claim on behalf of employee | Tenant session |
| GET | `/api/reimbursements/[id]` | Get claim detail | Tenant session |
| PUT | `/api/reimbursements/[id]` | Update claim fields | Tenant session |
| POST | `/api/reimbursements/[id]/approve` | Approve | Tenant session |
| POST | `/api/reimbursements/[id]/reject` | Reject | Tenant session |
| POST | `/api/reimbursements/[id]/freeze` | Freeze | Tenant session |
| POST | `/api/reimbursements/[id]/pay` | Mark as paid (only from approved) | Tenant session |
| GET | `/api/reimbursements/[id]/receipt` | Serve receipt file | Tenant session |

#### Super Admin Oversight (remedygcc-admin)

| Method | Route | Action | Auth |
|--------|-------|--------|------|
| GET | `/api/super-admin/reimbursements` | Cross-tenant claims list | Super Admin session |

### CRUD Matrix (Claim/Reimbursement)

| Operation | Employee | Tenant Admin | Super Admin |
|-----------|:--------:|:------------:|:-----------:|
| **Create** | ✓ | ✓ (on behalf) | ✗ |
| **Read** (own/list) | ✓ (self only) | ✓ (tenant-scoped) | ✓ (cross-tenant) |
| **Read** (detail) | ✓ (own only) | ✓ | ✓ |
| **Update** (pending) | ✗ | ✓ | ✗ |
| **Approve** | ✗ | ✓ | ✗ |
| **Reject** | ✗ | ✓ | ✗ |
| **Freeze** | ✗ | ✓ | ✗ |
| **Pay** | ✗ | ✓ (approved→only) | ✗ |
| **Upload receipt** | ✓ | ✓ | ✗ |
| **View receipt** | ✓ (own only) | ✓ | ✓ |

---

## 4. Role / Stakeholder Access Summary

### The Three Authentication Systems

The system has **three independent auth silos** — not a unified RBAC:

```
┌───────────────────────────────────────────────────┐
│  SYSTEM 1: Super Admin (remedygcc-admin)           │
│  ├── Roles: super_admin | admin (NOT enforced)     │
│  ├── Auth: email+password, cookie session          │
│  └── Scope: cross-tenant visibility                │
├───────────────────────────────────────────────────┤
│  SYSTEM 2: Tenant Dashboard (remedygcc-admin +     │
│            tenantapp)                               │
│  ├── Roles: none (all tenant users equal)          │
│  ├── Auth: email+password, tds_* cookie session    │
│  └── Scope: single-tenant                          │
├───────────────────────────────────────────────────┤
│  SYSTEM 3: Employee Access (remedygcc-marketing +  │
│            tenantapp)                               │
│  ├── Roles: none (all employees equal)             │
│  ├── Auth: PIN-based, HMAC cookie session          │
│  └── Scope: self (own claims only)                │
└───────────────────────────────────────────────────┘
```

### Access Matrix (Claims + Employees)

| Capability | Super Admin | Super Admin (admin) | Tenant Admin | Employee |
|------------|:-----------:|:-------------------:|:------------:|:--------:|
| View all claims (cross-tenant) | ✓ | ✓ | ✗ | ✗ |
| View tenant-scoped claims | ✓ | ✓ | ✓ | ✗ |
| View own claims | — | — | — | ✓ |
| Create claim (any employee) | ✗ | ✗ | ✓ | ✗ |
| Create own claim | — | — | — | ✓ |
| Approve/reject/freeze/pay | ✗ | ✗ | ✓ | ✗ |
| Edit pending claim | ✗ | ✗ | ✓ | ✗ (Phase 2) |
| List employees (tenant) | ✗ | ✗ | ✓ | ✗ |
| Create employees | ✗ | ✗ | ✓ | ✗ |
| Disable/unlock employees | ✗ | ✗ | ✓ | ✗ |
| Reset employee PIN | ✗ | ✗ | ✓ | ✗ |
| Login as employee | ✗ | ✗ | ✗ | ✓ |
| View receipt files | ✓ | ✓ | ✓ | ✓ (own only) |

> **Note:** `super_admin` and `admin` roles are defined in `AdminDocument.role` but **no middleware or guard inspects this field**. Both roles have identical access. The role is vestigial.

---

## 5. Validation & Business Rules

### Employee Validation

| Rule | Where | Enforced |
|------|-------|:--------:|
| PIN min 4 chars | Service (`validatePin`) | Server |
| PIN max 20 chars | Client form | Client |
| Email format | Client form regex | Client |
| Employee code unique per tenant | DB unique compound index | DB |
| Max 5 failed logins → 15m lockout | Service (`loginEmployee`) | Server |
| Cannot update PIN for inactive employee | Service (`updateEmployeePin`) | Server |
| Cannot unlock non-locked employee | Service (`unlockEmployee`) | Server |

### Claim Validation

| Rule | Where | Enforced |
|------|-------|:--------:|
| Amount > 0, ≤ 999,999,999 | Route + Service | Server |
| Description ≤ 2000 chars | Route | Server |
| Receipt file: PDF/JPG/PNG, ≤ 10MB | Client form + route | Both |
| Service date not in future | Client form | Client |
| Only approved → paid transition | Service (`payReimbursement`) | Server |
| Claim number auto-generated | Service (`generateClaimNumber`) | Server |
| Receipt SHA-256 hash stored | Service | Server |
| Tenant isolation on access | Service (checks `tenantId` match) | Server |
| Employee ownership (employee API) | Route (checks `tenantId`+`employeeCode`) | Server |

---

## 6. Architecture Patterns

### Layer Structure

```
┌─────────────────────────────────────────────────┐
│  Pages/Components (React Client Components)      │
├─────────────────────────────────────────────────┤
│  API Routes (Next.js App Router handlers)       │
├─────────────────────────────────────────────────┤
│  Services (Business logic + orchestration)       │
├─────────────────────────────────────────────────┤
│  Repositories (Data access: MongoDB / in-memory) │
├─────────────────────────────────────────────────┤
│  DB Layer (Raw MongoDB driver, no ORM)           │
└─────────────────────────────────────────────────┘
```

### Service Layer (`tenantapp/src/server/services/`)

- `employeeService.ts` (528 lines) — CRUD, PIN auth, lockout, audit events
- `reimbursementService.ts` (259 lines) — CRUD, status transitions, claim numbers, audit trail
- `claimNumberService.ts` — Atomic counter for RMB-YYYY-NNNNNN

### Repository Pattern

- **Interface:** `contracts.ts` defines `EmployeesRepositoryContract`, `ReimbursementsRepositoryContract`
- **MongoDB impl:** `employeesRepository.ts`, `reimbursementsRepository.ts` — production
- **In-memory impl:** `memoryRepositoryContext.ts` — tests + dev
- **Swappable via:** `context.ts` (factory that wires the correct impl)

### Auth Guard Pattern

Every tenant API route calls one of:
- `requireApiAuth(request)` — Super Admin (remedygcc-admin)
- `requireTenantApiAuth(request)` — Tenant Dashboard (both apps)
- `getSession()` — Employee (marketing site)

No declarative/annotation-based guards. All are inline at top of handler.

### Cross-App Communication

```
remedygcc-marketing ──── HTTPS + ADMIN_API_KEY ──── tenantapp
       │                                                    │
  Employee-facing UI                                   Source of truth
  (proxies all data)                                   (MongoDB, services)
```

Super admin's `remedygcc-admin` also proxies to `tenantapp` for cross-tenant data.

---

## 7. Known Gaps & Phase 3 Plans

| Gap | Current Behavior | Planned (Phase 3) |
|-----|-----------------|-------------------|
| No RBAC enforcement | `admin` vs `super_admin` stored but never checked | Proper role/permission system |
| Employee name denormalized | Changing employee name doesn't update claims | Backfill or live ref |
| Claim editing by employee | Employee cannot edit rejected claim | Re-submission workflow |
| Multi-approval thresholds | Single-step approval only | TBD |
| Budget / limits | No budget tracking per employee/tenant | Claim amount limits per period |
| Clinic as first-class entity | Denormalized on claim only | Formal Clinic model |
| Reimbursement → Claim rename | `ReimbursementDocument` type, "Claims" in UI | Rename to `Claim` everywhere |
| No Zod schemas | Inline validation only | Centralized validation schemas |
| Employee → User | Employee identity scoped to tenant | Platform-wide User + OrganizationMembership |
| Anonymous claims | Not supported | Visibility flag + anonymous reference |

---

## 8. Dependency Flow (Import Graph)

```
Page/Component ──→ API Route ──→ Service ──→ Repository ──→ MongoDB
                     │              │             │
                     │              ├── contract  │
                     │              │   types     │
                     │              │             │
                     └──────────────┴─────────────┘
```

**Key files:**
- `documents.ts` — All document type definitions (single source of truth)
- `contracts.ts` — Repository interfaces + query types
- `employeeService.ts` — All employee business logic
- `reimbursementService.ts` — All claim business logic
- `context.ts` — Wires repositories (MongoDB or in-memory)

---

## 9. Scale Capacity Notes

| Dimension | Capacity | Bottleneck |
|-----------|----------|------------|
| Employees per tenant | Typically hundreds to low thousands | No hard limit — `tenantId` index |
| Claims per employee | Hundreds per year | No hard limit — `tenantId+employeeId` index |
| Receipt file size | 10MB max | Client + route check |
| Pagination | Skip/limit based | Standard — no cursor yet |
| Claim number space | 999,999 per year | 7-digit counter, resets yearly (actually it's 6-digit = 999,999) |
| Search | Regex on `claimNumber` + `employeeName` (marketing); wider in admin API | Inefficient at scale — no text index yet |
| Concurrency | Single MongoDB; no distributed locking | Counter uses atomic `findOneAndUpdate` |
| Audit trail | Append-only array on document | Unlimited growth — may need capped collection for history |

---

## 10. File Reference Table

| File | Purpose |
|------|---------|
| `tenantapp/src/server/db/documents.ts:115` | `EmployeeDocument` type |
| `tenantapp/src/server/db/documents.ts:132` | `ClaimHistoryEntry` type |
| `tenantapp/src/server/db/documents.ts:140` | `ReimbursementDocument` type |
| `tenantapp/src/server/db/documents.ts:167` | `AuditEventDocument` type |
| `tenantapp/src/server/repositories/contracts.ts:105` | `EmployeesRepositoryContract` |
| `tenantapp/src/server/repositories/contracts.ts:125` | `ReimbursementsRepositoryContract` |
| `tenantapp/src/server/repositories/employeesRepository.ts` | MongoDB employee repo |
| `tenantapp/src/server/repositories/reimbursementsRepository.ts` | MongoDB reimbursement repo |
| `tenantapp/src/server/services/employeeService.ts` | Employee business logic |
| `tenantapp/src/server/services/reimbursementService.ts` | Claim business logic |
| `tenantapp/src/server/services/claimNumberService.ts` | Claim number generation |
| `tenantapp/src/server/services/__tests__/employee-crud.test.ts` | Employee CRUD tests |
| `tenantapp/src/server/services/__tests__/employee-access.test.ts` | Employee auth tests |
| `tenantapp/src/server/services/__tests__/reimbursement-crud.test.ts` | Reimbursement CRUD tests |
| `tenantapp/src/server/services/__tests__/claim-number.test.ts` | Claim number tests |
| `tenantapp/app/api/employees/route.ts` | Employee list/create API |
| `tenantapp/app/api/employees/[id]/route.ts` | Employee detail/update/disable |
| `tenantapp/app/api/reimbursements/route.ts` | Claim list/create API |
| `tenantapp/app/api/reimbursements/[id]/route.ts` | Claim detail/update |
| `tenantapp/app/api/reimbursements/[id]/approve/route.ts` | Approve claim |
| `tenantapp/app/api/reimbursements/[id]/reject/route.ts` | Reject claim |
| `tenantapp/app/api/reimbursements/[id]/freeze/route.ts` | Freeze claim |
| `tenantapp/app/api/reimbursements/[id]/pay/route.ts` | Pay claim |
| `tenantapp/app/api/employee/login/route.ts` | Employee login |
| `tenantapp/app/api/employee/reimbursements/route.ts` | Employee claims (proxy target) |
| `remedygcc-admin/src/app/api/super-admin/reimbursements/route.ts` | Super admin cross-tenant view |
| `remedygcc-admin/src/server/auth/repository.ts` | Admin role type (`super_admin\|admin`) |
| `remedygcc-marketing/src/lib/employee-access/session.ts` | Employee session (HMAC cookies) |
| `remedygcc-marketing/src/types/employee-access.ts` | Employee session types |
| `remedygcc-marketing/src/app/api/employee-access/reimbursements/route.ts` | Employee claim creation proxy |
| `remedygcc-marketing/src/app/api/employee-access/claims/route.ts` | Employee claims list proxy |
| `remedygcc-marketing/src/app/api/employee-access/login/route.ts` | Employee login proxy |
