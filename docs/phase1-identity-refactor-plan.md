# Phase 1 — Identity & Employee Model Refactor

## Engineering Blueprint — Final

> **Status:** Architecture Frozen — Approved for Implementation  
> **Date:** 2026-07-18  
> **Document Type:** Engineering Specification  
> **Audience:** Developers and AI coding agents  
> **Constraint:** No implementation in this document. Every spec here is what gets built.

### Blueprint Status

This document is the authoritative implementation specification for Phase 1. The architecture is now frozen.

Development should proceed according to this specification. Any architectural improvements discovered during implementation should be documented separately for future phases rather than changing this blueprint mid-development.

**Frozen sections:** Architecture, Data Model, APIs, DTOs, Services, Repositories, UI Structure, Permissions, Validation, Roadmap.

**Mutable sections:** Bug fixes, test additions, documentation clarifications that do not alter the architecture.

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [Domain Terminology](#2-domain-terminology)
3. [Final Data Model](#3-final-data-model)
4. [Registration Flow](#4-registration-flow)
5. [Authentication Architecture](#5-authentication-architecture)
6. [Backend Blueprint](#6-backend-blueprint)
7. [Frontend Blueprint](#7-frontend-blueprint)
8. [Role Permissions Matrix](#8-role-permissions-matrix)
9. [Validation Rules](#9-validation-rules)
10. [Error Handling](#10-error-handling)
11. [UI Copy](#11-ui-copy)
12. [Greenfield Context](#12-greenfield-context)
13. [Testing Strategy](#13-testing-strategy)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Future Phases](#15-future-phases)

---

## 1. Guiding Principles

These principles are final. Every design decision in this document derives from them.

**Principle 1 — Employees own their identity.**  
Organizations only authorize access. An organization creates a placeholder record (employee code + email). The employee activates it by registering.

**Principle 2 — Organizations never manage credentials.**  
Only employees and Super Admin touch passwords. Tenant Admin cannot create, reset, change, or view passwords. This is enforced at the API and service layer.

**Principle 3 — Employee identity is anonymous to organizations.**  
Organizations see: Employee Code, Email, Status, Claims.  
Organizations never see: Name, Phone, Bank Details, Password, Personal Profile.

**Principle 4 — Claims must never expose employee identity.**  
Employee name is stripped from claim API responses for Tenant Admin callers. The underlying data is preserved — filtering happens at the response layer.

**Principle 5 — Future features must preserve anonymity.**  
Every Phase 2+ feature (CSV import, self-registration, etc.) must not introduce identity leaks. Design the Phase 1 data model with this constraint.

**Principle 6 — Build only what Phase 1 requires.**  
Prepare for the future. Do not build the future today. If a feature is not in this document, it is deferred to a future phase.

**Principle 7 — Employees own their credentials.**  
Organizations authorize employee access but never create, know, or manage employee passwords. Tenant Admin has zero password capabilities. Only the employee and Super Admin interact with credentials.

---

## 2. Domain Terminology

### Employee Status

| Status Value | Business Label | Meaning |
|-------------|----------------|---------|
| `not_registered` | Not Registered | Tenant Admin created the record. Employee has not completed registration. |
| `active` | Active | Employee has registered and can log in. |
| `inactive` | Inactive | Tenant Admin deactivated the employee. Employee cannot log in. |
| `suspended` | Suspended | Super Admin suspended the employee. Employee cannot log in. |

**Why `not_registered` instead of `pending`:**  
`pending` is ambiguous — it doesn't tell the reader who is waiting for what. `not_registered` is self-documenting: the employee hasn't completed registration yet. It maps directly to the business action the employee needs to take.

### Actor Naming

| Actor | Code Constant | Description |
|-------|--------------|-------------|
| Employee | `"employee"` | The person receiving benefits |
| Tenant Admin | `"tenant_admin"` | Organization staff using the dashboard |
| Super Admin | `"super_admin"` | Remedy platform administrators |

### Entity Naming

| Entity | Collection Name | Document Type |
|--------|----------------|---------------|
| Employee | `employees` | `EmployeeDocument` |
| Claim | `reimbursements` | `ReimbursementDocument` (unchanged) |

No new collections in Phase 1. No `AuthorizedEmployeeEntry`. No `PasswordResetToken`.

---

## 3. Final Data Model

### 3.1 EmployeeDocument

**Collection:** `employees`  
**File:** `tenantapp/src/server/db/documents.ts`

```
Current Field              →  Future Field           Change Type
────────────────────────────────────────────────────────────────
employeeId: string         →  UNCHANGED              —
tenantId: string           →  UNCHANGED              —
employeeCode: string       →  UNCHANGED              —
name: string               →  UNCHANGED (nullable)   `null` until registration
email: string              →  UNCHANGED              —
status:
  "active" | "inactive"   →  "not_registered"       Expanded — 4 states
                             | "active"
                             | "inactive"
                             | "suspended"
pinHash: string            →  REMOVED                Replaced by passwordHash
passwordHash: string       →  NEW                    bcrypt hash, nullable until registration
mustChangePassword: boolean → NEW                    false by default, true after Super Admin reset
phoneNumber?: string       →  NEW                    Set during employee registration
failedLoginAttempts        →  UNCHANGED              —
lockedUntil                →  UNCHANGED              —
lastAccessAt               →  UNCHANGED              —
createdAt                  →  UNCHANGED              —
updatedAt                  →  UNCHANGED              —
```

### 3.2 MongoDB Indexes

**File:** `tenantapp/src/server/repositories/employeesRepository.ts`

| Index | Action | Purpose |
|-------|--------|---------|
| `{ employeeId: 1 }` unique | KEEP | Primary lookup |
| `{ tenantId: 1 }` | KEEP | Tenant-scoped listing |
| `{ tenantId: 1, employeeCode: 1 }` unique | KEEP | Tenant-scoped code uniqueness |
| `{ tenantId: 1, name: 1 }` | KEEP | Super Admin search |
| `{ tenantId: 1, email: 1 }` | **ADD** | Tenant-scoped login lookup |

### 3.3 AuditEventDocument

**Action enum expanded:**

```typescript
// Current
action: "pin_reset" | "employee_unlock"

// Future
action:
  | "pin_reset"           // REMOVED (no more PINs)
  | "employee_unlock"      // KEPT
  | "employee_suspended"   // NEW
  | "employee_unsuspended" // NEW
  | "employee_registered"  // NEW
  | "password_reset"       // NEW (Super Admin initiated)
  | "password_changed"     // NEW (Employee self-initiated)
```

### 3.4 ReimbursementDocument

**No changes.** The `employeeName` field stays on the document. Anonymity is enforced at the API response layer — see Section 6.5.

---

## 4. Registration Flow

### 4.1 Sequence

```
Tenant Admin
  │  POST /api/employees { employeeCode, email }
  ▼
EmployeeDocument created
  status: "not_registered"
  passwordHash: null
  name: null
  phoneNumber: null

  ─ ─ ─ Employee visits portal ─ ─ ─

Employee clicks "Sign Up"
  │  POST /api/employee/register
  │  { tenantSlug, employeeCode, email, password, name, phone? }
  ▼
System validates:
  ✓ Employee exists (tenantId + employeeCode)
  ✓ Employee belongs to org (tenantSlug resolves to tenantId)
  ✓ Email matches employee record
  ✓ Employee is not_registered (registration not already completed)
  ✓ Account is not inactive or suspended
  ✓ Password meets strength requirements
  ✓ Name is provided and non-empty

  ▼
EmployeeDocument updated:
  status: "active"
  passwordHash: bcrypt(password)
  name: provided name
  phoneNumber: provided phone (optional)
  mustChangePassword: false
  lastAccessAt: now

  ▼
Session created (HMAC cookie)
Employee redirected to portal
```

### 4.2 Registration Validation Rules

| Field | Rule | Error Code |
|-------|------|------------|
| `tenantSlug` | Must resolve to an active tenant | `TENANT_NOT_FOUND` |
| `employeeCode` | Must match an existing employee in that tenant | `EMPLOYEE_NOT_FOUND` |
| `email` | Must exactly match the employee's stored email (case-insensitive) | `EMAIL_MISMATCH` |
| Employee status | Must be `not_registered` | `ALREADY_REGISTERED` |
| Employee status | Must not be `inactive` or `suspended` | `ACCOUNT_NOT_AVAILABLE` |
| `password` | Min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit | `WEAK_PASSWORD` |
| `name` | Required, non-empty, max 100 characters | `NAME_REQUIRED` |

### 4.3 Registration Response

**Success (201):**
```json
{
  "success": true,
  "employee": {
    "employeeId": "emp_...",
    "employeeCode": "EMP-001",
    "email": "employee@org.com",
    "name": "Employee Name",
    "status": "active",
    "phoneNumber": "+968XXXXXXXX",
    "lastAccessAt": "2026-07-18T12:00:00.000Z"
  }
}
```

The marketing site then creates an HMAC session and redirects to the portal.

**Error (400/401/403/409):**
```json
{
  "success": false,
  "error": "This account has already been registered.",
  "errorCode": "ALREADY_REGISTERED"
}
```

---

## 5. Authentication Architecture

### 5.1 What Stays

| Aspect | Current | Phase 1 |
|--------|---------|---------|
| Session format | HMAC-signed cookie | HMAC-signed cookie |
| Cookie name | `employee_session` | `employee_session` |
| Session TTL | 24 hours | 24 hours |
| Signing algorithm | HMAC-SHA256 | HMAC-SHA256 |
| Cookie options | httpOnly, secure, sameSite=lax | Same |
| Session library | `session.ts` | Same library, minor updates |
| Auth middleware | `requireTenantApiAuth()` | Same |
| API key auth | `x-admin-api-key` | Same |

### 5.2 What Changes

| Aspect | Current | Phase 1 |
|--------|---------|---------|
| Credential type | 4-6 digit PIN | Password (min 8 chars) |
| Hashing algorithm | scrypt (salt:hash) | bcrypt (salt rounds 12) |
| Login identifier | tenantSlug + employeeCode | tenantSlug + email + password (org required) |
| Change password | Not supported | Employee can change own password |
| Super Admin reset | Not supported | Generate temp password, mustChangePassword |
| Registration | Not supported | Employee self-registration flow |

### 5.3 HMAC Session Payload

**Unchanged.** The session still contains:

```typescript
interface EmployeeSession {
  employeeCode: string;
  employeeName: string;
  tenantId: string;
  tenantName: string;
  expiresAt: string; // ISO-8601, 24h from creation
}
```

For registration flow: after successful registration, the session is created with `employeeName` populated from the name the employee provided during registration.

### 5.4 Login Flow (Phase 1)

```
Employee → Login Form
  │  selects: organization, enters: email, password
  │  POST /api/employee-access/login (marketing proxy)
  │    → POST /api/employee/login (tenantapp)
  │    { tenantSlug, email, password }
  ▼

tenantapp:
  1. Route handler resolves `tenantSlug` → `tenantId`
  2. Route handler calls `loginEmployee(tenantId, email, password)`
  3. Service finds employee by `tenantId` + `email` (`findByTenantAndEmail()`)
  3. Check employee status:
     - "not_registered" → 403 "Please complete registration first"
     - "inactive" → 403 "Account is inactive"
     - "suspended" → 403 "Account is suspended"
     - "active" → continue
  4. bcrypt.compare(password, employee.passwordHash)
  5. If match → reset failedAttempts, update lastAccessAt
  6. If mustChangePassword → return flag (not a force-redirect, just a flag)
  7. If no match → increment failedAttempts, check lockout

marketing proxy:
  8. Receive SafeEmployee + mustChangePassword flag
  9. Create HMAC session cookie
  10. Return success response with mustChangePassword flag
```

### 5.5 Password Change Flow

```
Employee → Change Password Page
  │  POST /api/employee-access/change-password (marketing proxy)
  │    → POST /api/employee/change-password (tenantapp)
  │    Auth: HMAC session cookie
  │    { currentPassword, newPassword }
  ▼

tenantapp:
  1. Validate HMAC session → get employeeId
  2. bcrypt.compare(currentPassword, stored passwordHash)
  3. Validate newPassword strength
  4. Set new passwordHash, mustChangePassword = false
  5. Clear failedLoginAttempts, lockedUntil
  6. Return success
```

### 5.6 Phase 1 Password Recovery Strategy

**How password recovery works during Phase 1:**

| Method | Available? | Details |
|--------|:----------:|---------|
| Employee creates password during registration | **✓** | Employee sets their own password as part of the sign-up flow. No recovery needed at this stage. |
| Employee changes password after login | **✓** | Authenticated employee can change their password at any time via the Change Password page. Requires knowing the current password. |
| Super Admin password reset | **✓** | If an employee forgets their password, Super Admin uses the admin dashboard to generate a temporary password. The temporary password is shown once in the admin UI, communicated to the employee out-of-band (phone, in-person, etc.), and never stored in plaintext. The employee is forced to change it on next login (`mustChangePassword = true`). |
| Forgot Password (self-service) | **✗** | Intentionally deferred to Phase 2. Requires email infrastructure. |

**Key rules:**
- Temporary passwords are shown exactly once in the Super Admin UI response.
- Temporary passwords are never stored in plaintext — only the bcrypt hash is persisted.
- The employee must change their password on first login after a reset (`mustChangePassword` flag).
- This mechanism exists only until Phase 2 introduces self-service forgot password.

---

## 6. Backend Blueprint

### 6.1 Database Layer

#### 6.1.1 documents.ts

**File:** `tenantapp/src/server/db/documents.ts`

**Changes — EmployeeDocument:**
- `status` type expands from `"active" | "inactive"` to `"not_registered" | "active" | "inactive" | "suspended"`
- `pinHash: string` → `passwordHash: string` (and nullable — `string | null`)
- Add `mustChangePassword: boolean`
- Add `phoneNumber?: string`

**Changes — AuditEventDocument:**
- `action` type expands:
  - Remove `"pin_reset"`
  - Add `"employee_suspended"`, `"employee_unsuspended"`, `"employee_registered"`, `"password_reset"`, `"password_changed"`

**Changes — COLLECTION_NAMES:**
- No changes needed (employees collection stays)

**Greenfield context:** This is a greenfield implementation. There are zero existing employee accounts. No migration script, rollback script, or legacy data handling is required. The system starts directly with the new password-based model.

### 6.2 Repository Layer

#### 6.2.1 Repository Contract

**File:** `tenantapp/src/server/repositories/contracts.ts`

**Changes to `EmployeesRepositoryContract`:**

| Method | Action | Signature |
|--------|--------|-----------|
| `findByTenantAndEmail(tenantId, email)` | **ADD** | `findByTenantAndEmail(tenantId: string, email: string): Promise<EmployeeDocument \| null>` |
| `findByEmployeeCode(tenantId, code)` | **KEEP** | No change |
| `findByTenantId(tenantId, options)` | **KEEP** | No change |
| `findById(id)` | **KEEP** | No change |
| `insert(employee)` | **KEEP** | No change |
| `update(id, updates)` | **KEEP** | No change |
| `insertAuditEvent(event)` | **KEEP** | No change |
| `ensureIndexes()` | **MODIFY** | Add `{ email: 1 }` index |

#### 6.2.2 MongoDB Repository

**File:** `tenantapp/src/server/repositories/employeesRepository.ts`

**Changes:**
1. Add `findByTenantAndEmail()` method:
   ```typescript
   async findByTenantAndEmail(tenantId: string, email: string): Promise<EmployeeDocument | null> {
     const record = await this.collection().findOne(
       { tenantId, email: email.toLowerCase().trim() },
       { projection: { _id: 0 } },
     );
     return record as EmployeeDocument | null;
   }
   ```
   Note: Email lookup is always tenant-scoped because login requires Organization selection.

2. Add `{ tenantId: 1, email: 1 }` compound index in `ensureIndexes()`:
   ```typescript
   { key: { tenantId: 1, email: 1 }, name: "employee_tenant_email" }
   ```

3. All other methods unchanged.

#### 6.2.3 Memory Repository

**File:** `tenantapp/src/server/repositories/memoryRepositoryContext.ts`

**Changes to `MemoryEmployeesRepository`:**
1. Add `findByTenantAndEmail()` — filter by tenantId first, then match email
2. Update seed data: replace `DEV_PIN_HASH` with a known bcrypt hash of `"Password123"`
3. Add seed employees with `status: "not_registered"` and `passwordHash: null` for registration testing

### 6.3 Service Layer

#### 6.3.1 Employee Service

**File:** `tenantapp/src/server/services/employeeService.ts`

##### Functions Removed (6)

| Function | Reason |
|----------|--------|
| `hashPin(pin)` | PIN auth removed |
| `verifyPin(stored, pin)` | PIN auth removed |
| `normalizePin(pin)` | PIN auth removed |
| `validatePin(pin)` | Replaced by password validation |
| `resetEmployeePin(tenantId, employeeId, performedBy)` | PIN reset removed |
| `updateEmployeePin(tenantId, employeeId, pin, performedBy, auditAction)` | PIN update removed |

##### Constants Changed

| Constant | Old Value | New Value |
|----------|-----------|-----------|
| `MIN_PIN_LENGTH = 4` | `MIN_PIN_LENGTH` | `MIN_PASSWORD_LENGTH = 8` |
| `KEY_LENGTH = 64` | scrypt key length | Remove (bcrypt handles this) |
| `MAX_LOGIN_ATTEMPTS = 5` | Unchanged | Unchanged |
| `LOCKOUT_MINUTES = 15` | Unchanged | Unchanged |

##### Functions Added (5)

**1. `hashPassword(password: string): string`**
- Input: plain-text password
- Output: bcrypt hash string (salt rounds: 12)
- Algorithm: `bcrypt.hashSync(password, 12)`
- Import: `import { hashSync, compareSync } from "bcrypt-ts"` (or `bcrypt` depending on package)

**2. `verifyPassword(password: string, hash: string): boolean`**
- Input: plain-text password + stored bcrypt hash
- Output: boolean
- Algorithm: `compareSync(password, hash)`

**3. `validatePasswordStrength(password: unknown): string | null`**
- Returns error message or null if valid
- Rules:
  - Must be a string
  - Min 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 digit
- Error message: "Password must be at least 8 characters with uppercase, lowercase, and a digit."

**4. `registerEmployee(tenantId: string, employeeCode: string, email: string, password: string, name: string, phone?: string): Promise<SafeEmployee>`**
- Validates employee exists (tenantId + employeeCode)
- Validates email matches stored email (case-insensitive)
- Validates status is `not_registered` (not already registered)
- Validates employee is not inactive or suspended
- Sets `passwordHash` (bcrypt), `name`, `phoneNumber`, `status: "active"`, `lastAccessAt: now`
- Records audit event: `action: "employee_registered"`
- Returns `SafeEmployee` (name included — this is the employee's own data)

**5. `changePassword(employeeId: string, currentPassword: string, newPassword: string): Promise<SafeEmployee>`**
- Validates current password via bcrypt
- Validates new password strength
- Updates `passwordHash`, `mustChangePassword: false`
- Resets `failedLoginAttempts: 0`, `lockedUntil: null`
- Records audit event: `action: "password_changed"`
- Returns `SafeEmployee`

##### Functions Modified (5)

**1. `loginEmployee(tenantId: string, email: string, password: string): Promise<LoginResult>`**

Signature change from `(tenantId, employeeCode, pin)` to `(tenantId, email, password)`.

New flow:
1. Find employee by `tenantId` + `email` using `findByTenantAndEmail()` (always tenant-scoped)
2. Check employee status:
   - `not_registered` → return `errorCode: "NOT_REGISTERED"`
   - `inactive` → return `errorCode: "EMPLOYEE_INACTIVE"`
   - `suspended` → return `errorCode: "EMPLOYEE_SUSPENDED"`
   - `active` → continue
4. If `passwordHash` is null → return `errorCode: "NOT_REGISTERED"`
5. `verifyPassword(password, employee.passwordHash)`
6. Lockout logic unchanged (same as current: 5 attempts → 15 min lockout)
7. On success: reset attempts, update `lastAccessAt`, return `SafeEmployee`
8. If `employee.mustChangePassword` is true, include `mustChangePassword: true` in response

```typescript
export interface LoginResult {
  success: boolean;
  employee?: SafeEmployee;
  mustChangePassword?: boolean;
  error?: string;
  errorCode?:
    | "NOT_REGISTERED"
    | "EMPLOYEE_NOT_FOUND"
    | "EMPLOYEE_INACTIVE"
    | "EMPLOYEE_SUSPENDED"
    | "EMPLOYEE_LOCKED"
    | "INVALID_PASSWORD";
  lockedUntil?: string | null;
}
```

**2. `createEmployee(tenantId: string, data: { employeeCode: string; email: string }): Promise<EmployeeDocument>`**

Signature change from `(tenantId, { employeeCode, name, email, pin })` to `(tenantId, { employeeCode, email })`.

New behavior:
- Creates employee with `status: "not_registered"`
- `name` field: empty string `""` (will be filled during registration)
- `passwordHash: null`
- `mustChangePassword: false`
- `phoneNumber: undefined`
- `failedLoginAttempts: 0`, `lockedUntil: null`, `lastAccessAt: null`

```typescript
const employee: EmployeeDocument = {
  employeeId: `emp_${randomUUID()}`,
  tenantId,
  employeeCode: data.employeeCode.trim(),
  name: null, // null until registration
  email: data.email.toLowerCase().trim(),
  status: "not_registered",
  passwordHash: null,
  mustChangePassword: false,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastAccessAt: null,
  createdAt: now,
  updatedAt: now,
};
```

**3. `listEmployees(tenantId: string, options?, callerRole: CallerRole): Promise<{ employees: SafeEmployeeDocument[]; total }>`**

Add `callerRole` parameter (type: `"super_admin" | "tenant_admin"`).

New behavior:
- If `callerRole === "tenant_admin"`:
  - Strip `name`, `phoneNumber`, `failedLoginAttempts`, `lockedUntil`, `lastAccessAt`, `mustChangePassword` from each employee
  - Return: `employeeId`, `employeeCode`, `email`, `status`, `createdAt`, `updatedAt`
- If `callerRole === "super_admin"`:
  - Return all fields except `passwordHash`

**4. `getEmployee(employeeId: string, tenantId: string, callerRole: CallerRole): Promise<...>`**

Add `callerRole` parameter. Same filtering as `listEmployees`.

**5. `disableEmployee(tenantId: string, employeeId: string)`**
- Unchanged behavior. Tenant Admin can still set status to `inactive`.
- Validates employee belongs to tenant.

##### Functions Moved (2)

These functions exist but their caller changes from Tenant Admin to Super Admin:

**`unlockEmployee(tenantId, employeeId, performedBy)`**
- Remains in service layer
- Removed from Tenant Admin API routes
- Called from NEW Super Admin API routes only

**`suspendEmployee` / `unsuspendEmployee`** (NEW)
- Add functions analogous to `disableEmployee` but setting `status: "suspended"` and `status: "active"`
- Only callable from Super Admin routes

#### 6.3.2 Reimbursement Service

**File:** `tenantapp/src/server/services/reimbursementService.ts`

**No structural changes.** The `employeeName` field is still stored on `ReimbursementDocument`. Filtering happens at the API layer.

However, note: when an employee registers in Phase 1 and sets their name, existing claims created before registration still have the old name (or empty name). This is acceptable — the name on the claim is a snapshot taken at creation time.

### 6.4 API Layer

#### 6.4.0 Shared API Contracts (DTOs)

```typescript
// ── Shared ──────────────────────────────────────────────────────────────────

interface ApiErrorResponse {
  success: false;
  error: string;
  errorCode: string;
}

// ── Tenant Admin Employee APIs ───────────────────────────────────────────────

interface CreateEmployeeRequest {
  employeeCode: string;   // 1-50 chars, alphanumeric + hyphens/underscores
  email: string;          // valid email, lowercased on store
}

interface CreateEmployeeResponse {
  employeeId: string;
  employeeCode: string;
  email: string;
  status: "not_registered";
  createdAt: string;
}

interface EmployeeListItem {
  employeeId: string;
  employeeCode: string;
  email: string;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
  // name, phoneNumber, failedLoginAttempts, lockedUntil, lastAccessAt, mustChangePassword — NOT returned
}

interface ListEmployeesResponse {
  employees: EmployeeListItem[];
  total: number;
}

interface UpdateEmployeeRequest {
  employeeCode?: string;
  email?: string;
  status?: "active" | "inactive";
  // name, phoneNumber, passwordHash — CANNOT be updated by Tenant Admin
}

interface DeactivateEmployeeRequest {
  status: "inactive";
}

// ── Employee-Facing APIs ─────────────────────────────────────────────────────

interface RegisterEmployeeRequest {
  tenantSlug: string;       // required — selects the organization
  employeeCode: string;     // must match the placeholder created by Tenant Admin
  email: string;            // must match the stored email (case-insensitive)
  password: string;         // min 8 chars, uppercase, lowercase, digit
  name: string;             // 1-100 chars, required
  phone?: string;           // optional
}

interface RegisterEmployeeResponse {
  success: true;
  employee: SafeEmployee;
}

interface LoginRequest {
  tenantSlug: string;       // required — selects the organization. Email lookup is tenant-scoped.
  email: string;            // employee's registered email (looked up within the selected tenant)
  password: string;         // employee's password
}

interface LoginResponse {
  success: true;
  employee: SafeEmployee;
  mustChangePassword?: boolean;
}

interface ChangePasswordRequest {
  employeeId: string;
  currentPassword: string;
  newPassword: string;      // min 8 chars, uppercase, lowercase, digit
}

interface ChangePasswordResponse {
  success: true;
  employee: SafeEmployee;
}

// ── Super Admin APIs ─────────────────────────────────────────────────────────

interface SuperAdminEmployeeListItem {
  employeeId: string;
  employeeCode: string;
  email: string;
  name: string;
  phoneNumber?: string | null;
  status: EmployeeStatus;
  tenantId: string;
  tenantName?: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastAccessAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  // passwordHash — NEVER returned
}

interface ListSuperAdminEmployeesResponse {
  employees: SuperAdminEmployeeListItem[];
  total: number;
}

interface ResetPasswordResponse {
  temporaryPassword: string;  // shown once, not stored
  mustChangePassword: true;
}

interface SuperAdminActionResponse {
  success: true;
  employee: SuperAdminEmployeeListItem;
}
```

**Contract Stability:**
- These DTOs are the authoritative contract between frontend and backend. All implementations must strictly follow these shapes.
- Frontend teams and backend teams must treat these interfaces as the source of truth.
- Any future breaking change to these contracts requires API versioning or a coordinated frontend+backend deployment.
- No endpoint may return fields beyond what is documented in its DTO.
- No endpoint may omit fields that the DTO declares as present.

#### 6.4.1 Tenant Admin Employee APIs

**`POST /api/employees`**

| Aspect | Detail |
|--------|--------|
| Purpose | Create employee (authorization placeholder) |
| Auth | `requireTenantApiAuth()` |
| Request | `CreateEmployeeRequest` |
| Response (201) | `CreateEmployeeResponse` |
| Validation | `employeeCode` — required, trim, non-empty |
| | `email` — required, valid email format |
| Errors | `400` — `ApiErrorResponse` (missing fields) |
| | `409` — `ApiErrorResponse` (duplicate employeeCode) |
| Service | `createEmployee(tenantId, { employeeCode, email })` |

**`GET /api/employees`**

| Aspect | Detail |
|--------|--------|
| Purpose | List employees for tenant (anonymous) |
| Auth | `requireTenantApiAuth()` |
| Query | `?search=&status=&skip=0&limit=20` |
| Response | `ListEmployeesResponse` |
| Fields NOT returned | `name`, `phoneNumber`, `failedLoginAttempts`, `lockedUntil`, `lastAccessAt`, `mustChangePassword`, `passwordHash` |
| Search scope | `employeeCode`, `email` (NOT name) |
| Service | `listEmployees(tenantId, options, "tenant_admin")` |

**`GET /api/employees/[id]`**

| Aspect | Detail |
|--------|--------|
| Purpose | Get single employee detail (anonymous) |
| Auth | `requireTenantApiAuth()` |
| Response (200) | `EmployeeListItem` |
| Error | `404` — `ApiErrorResponse` |
| Service | `getEmployee(id, tenantId, "tenant_admin")` |

**`PUT /api/employees/[id]`**

| Aspect | Detail |
|--------|--------|
| Purpose | Update employee fields (limited) |
| Auth | `requireTenantApiAuth()` |
| Request | `UpdateEmployeeRequest` |
| Cannot update | `name`, `phoneNumber`, `passwordHash` |
| Error | `400` — `ApiErrorResponse` |
| Service | `updateEmployee(tenantId, id, data)` |

**`PATCH /api/employees/[id]`**

| Aspect | Detail |
|--------|--------|
| Purpose | Deactivate employee (status → inactive) |
| Auth | `requireTenantApiAuth()` |
| Request | `DeactivateEmployeeRequest` |
| Service | `disableEmployee(tenantId, id)` |

**~~`POST /api/employees/[id]/unlock`~~ REMOVED** — Moved to Super Admin.

**~~`POST /api/employees/[id]/reset-pin`~~ REMOVED** — Replaced by Super Admin reset-password.

#### 6.4.2 Employee-Facing APIs

**`POST /api/employee/register`**

| Aspect | Detail |
|--------|--------|
| Purpose | Complete employee registration (set name, phone, password) |
| Auth | None (public — first-time registration) |
| Request | `RegisterEmployeeRequest` |
| Response (201) | `RegisterEmployeeResponse` |
| Errors | See [Validation Rules](#9-validation-rules) — returns `ApiErrorResponse` |
| Service | Route handler resolves tenantSlug → tenantId, then calls `registerEmployee(tenantId, employeeCode, email, password, name, phone)` |

**`POST /api/employee/login`**

| Aspect | Detail |
|--------|--------|
| Purpose | Authenticate employee, return session data |
| Auth | None (public) |
| Request | `LoginRequest` (tenantSlug is required) |
| Response (200) | `LoginResponse` |
| Errors | `400` — `ApiErrorResponse` (missing fields) |
| | `401` — `ApiErrorResponse` (invalid credentials) |
| | `403` — `ApiErrorResponse` (inactive/suspended/not_registered) |
| | `429` — `ApiErrorResponse` (locked out) |
| Service | Route handler resolves tenantSlug → tenantId, then calls `loginEmployee(tenantId, email, password)` |

**`POST /api/employee/change-password`**

| Aspect | Detail |
|--------|--------|
| Purpose | Employee changes own password |
| Auth | API key (x-admin-api-key) — proxied from marketing site |
| Request | `ChangePasswordRequest` |
| Response (200) | `ChangePasswordResponse` |
| Errors | `400` — `ApiErrorResponse` (weak password) |
| | `401` — `ApiErrorResponse` (current password incorrect) |
| Service | `changePassword(employeeId, currentPassword, newPassword)` |

**`GET /api/employee/me`**

| Aspect | Detail |
|--------|--------|
| Purpose | Get own employee profile |
| Auth | API key (proxied) |
| Query | `?tenantSlug=&employeeCode=` |
| Response | `SafeEmployee` (includes `name`, `phoneNumber`, `mustChangePassword`) |
| Note | Employee sees their own `name` and `phoneNumber` |

#### 6.4.3 Super Admin APIs (NEW)

All under `tenantapp/app/api/super-admin/employees/`. Authenticated via `x-admin-api-key` header or Super Admin session.

**`GET /api/super-admin/employees`**

| Aspect | Detail |
|--------|--------|
| Purpose | Cross-tenant employee list (full visibility) |
| Auth | Admin API key or Super Admin session |
| Query | `?search=&status=&tenantId=&skip=0&limit=50` |
| Response | `{ employees: [...], total }` — includes `name`, `phoneNumber`, `status`, `failedLoginAttempts`, `lockedUntil`, `lastAccessAt`, `mustChangePassword` |
| Excludes | `passwordHash` |

**`GET /api/super-admin/employees/[id]`**

| Aspect | Detail |
|--------|--------|
| Purpose | Full employee detail |
| Auth | Admin API key or Super Admin session |
| Response | Full employee (all fields except `passwordHash`) |

**`POST /api/super-admin/employees/[id]/reset-password`**

| Aspect | Detail |
|--------|--------|
| Purpose | Administrative password reset. Super Admin generates a temporary password, employee is forced to change on next login. This serves as the Phase 1 forgot-password workaround. |
| Auth | Admin API key or Super Admin session |
| Response (200) | `{ temporaryPassword: "aB3kL9xR2mN7", mustChangePassword: true }` |
| Service | `resetEmployeePassword(tenantId, employeeId, performedBy)` |
| Notes | Generates 12-char alphanumeric password. Sets `passwordHash` (bcrypt). Sets `mustChangePassword: true`. Records audit event `password_reset`. Temporary password shown ONCE in response — not stored in plaintext. Super Admin communicates it to the employee out-of-band (phone, in-person, etc.). No email infrastructure involved. |

**`POST /api/super-admin/employees/[id]/unlock`**

| Aspect | Detail |
|--------|--------|
| Purpose | Clear lockout state |
| Auth | Admin API key or Super Admin session |
| Response (200) | `{ employee: SafeEmployee }` |
| Service | `unlockEmployee(tenantId, employeeId, performedBy)` (moved from tenant admin) |

**`POST /api/super-admin/employees/[id]/suspend`**

| Aspect | Detail |
|--------|--------|
| Purpose | Suspend employee account |
| Auth | Admin API key or Super Admin session |
| Service | `suspendEmployee(tenantId, employeeId, performedBy)` (NEW) |

**`POST /api/super-admin/employees/[id]/unsuspend`**

| Aspect | Detail |
|--------|--------|
| Purpose | Restore suspended employee |
| Auth | Admin API key or Super Admin session |
| Service | `unsuspendEmployee(tenantId, employeeId, performedBy)` (NEW) |

#### 6.4.4 Claim APIs (Visibility Filtering)

**`GET /api/reimbursements`** and **`GET /api/reimbursements/[id]`**

| Aspect | Detail |
|--------|--------|
| Change | Strip `employeeName` from response when caller is Tenant Admin |
| Tenant Admin response | `{ reimbursementId, claimNumber, tenantId, employeeId, clinicId, clinicName, amount, description, status, reviewedBy, reviewedAt, notes, history, createdAt, updatedAt }` |
| | **`employeeName` is REMOVED** |
| Super Admin response | Unchanged — includes `employeeName` |

**`GET /api/admin/reimbursements`**

| Aspect | Detail |
|--------|--------|
| Change | Role-aware response |
| Admin API key callers (Super Admin proxy) | Include `employeeName` |
| Tenant dashboard session callers | Strip `employeeName` |

**Implementation:**
- The `admin/reimbursements` route currently uses `authorizeRequest()` which accepts either API key OR tenant session
- Add a `callerRole` detection: if authorized via API key → Super Admin; if via tenant session → Tenant Admin
- Pass `callerRole` to the response mapper

### 6.5 Middleware

**No middleware changes in any of the three apps.**

- `remedygcc-admin/src/middleware.ts` — unchanged
- `remedygcc-admin/src/modules/tenant-auth/middleware/tenant-auth.ts` — unchanged
- `tenantapp/middleware.ts` — unchanged
- `tenantapp/src/modules/tenant-auth/middleware/tenant-auth.ts` — unchanged
- `remedygcc-marketing` — no middleware (unchanged)

---

## 7. Frontend Blueprint

### 7.1 Tenant Dashboard (tenantapp)

#### 7.1.1 Employee List Page

**File:** `tenantapp/components/employees/EmployeeListPage.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/employees` |
| Purpose | View all employees for the tenant (anonymous) |
| Permission | Tenant Admin only |

**Table Columns:**
| Column | Source | Notes |
|--------|--------|-------|
| Employee Code | `employee.employeeCode` | |
| Email | `employee.email` | |
| Status | `employee.status` | Badge: Not Registered / Active / Inactive / Suspended |
| Claims | *(calculated)* | Count of claims for this employee |
| Last Access | `employee.lastAccessAt` | Show relative time or "Never" |
| Actions | | Click row → detail page |

**Removed columns:**
- ~~Name~~ (never visible)

**Filters:**
- Status: dropdown (All / Not Registered / Active / Inactive / Suspended)
- Search: by Employee Code or Email (NOT name)

**States:**
| State | Behavior |
|-------|----------|
| Loading | Skeleton rows or spinner |
| Empty | "No employees found. Add your first employee to get started." + "Add Employee" button |
| Error | Error banner with retry button |
| Success | Paginated table, 20 per page |

**Actions:**
- "Add Employee" button → opens employee form
- Row click → navigates to `/employees/[id]`

#### 7.1.2 Employee Form (Add Employee)

**File:** `tenantapp/components/employees/EmployeeFormPage.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/employees/new` |
| Purpose | Create a new employee authorization (code + email) |
| Permission | Tenant Admin |

**Form Fields:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Employee Code | Text input | Yes | 1-50 chars, alphanumeric + hyphens/underscores |
| Email | Email input | Yes | Valid email format, 255 max chars |

**Removed fields:**
- ~~Name~~
- ~~PIN / Password~~

**Buttons:**
| Button | Action | State |
|--------|--------|-------|
| "Add Employee" | Submit form | Enabled when form valid |
| "Cancel" | Navigate back | Always enabled |

**States:**
| State | Behavior |
|-------|----------|
| Initial | Empty form, "Add Employee" disabled |
| Validation | Field errors shown inline |
| Submitting | Button disabled, spinner |
| Success | "Employee added successfully. They can now register via the employee portal." + "Add Another" + "Back to List" |
| Error (duplicate code) | "An employee with this code already exists." |
| Error (server) | Generic error banner |

**Success Copy:**
> **Employee Added**
> An invitation has been created for {email}. The employee can visit the portal and register using their employee code and email address.

#### 7.1.3 Employee Detail Page

**File:** `tenantapp/components/employees/EmployeeDetailPage.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/employees/[id]` |
| Purpose | View employee details and manage status |
| Permission | Tenant Admin (limited view) |

**Displayed Fields:**
| Field | Source |
|-------|--------|
| Employee Code | `employee.employeeCode` |
| Email | `employee.email` |
| Status | `employee.status` — badge with color |
| Created | `employee.createdAt` — formatted date |
| Updated | `employee.updatedAt` — formatted date |

**Hidden Fields (not shown):**
- ~~Name~~
- ~~Phone~~
- ~~Failed Login Attempts~~
- ~~Lockout State~~
- ~~Last Access~~
- ~~Must Change Password~~

**Actions (Tenant Admin):**
| Button | Action | Condition |
|--------|--------|-----------|
| "Deactivate" | PATCH `{ status: "inactive" }` | Status is `active` or `not_registered` |
| "Reactivate" | PATCH `{ status: "active" }` | Status is `inactive` |
| "View Claims" | Navigate to reimbursements filtered by this employee | Always |

**Removed Actions:**
- ~~Reset PIN~~
- ~~Unlock~~
- ~~Change Password~~
- ~~Edit Name~~

**States:**
| State | Behavior |
|-------|----------|
| Loading | Full-page spinner |
| Not found | "Employee not found" + back button |
| Error | Error banner with retry |
| Success | Full detail display, actions enabled as appropriate |

#### 7.1.4 Claims List Page (Tenant Admin)

**File:** `tenantapp/components/reimbursements/ReimbursementListPage.tsx`

**Change:** Remove the `employeeName` column from the table.

**Table Columns (updated):**
| Column | Notes |
|--------|-------|
| Claim # | RMB-2026-000001 |
| Status | Pending / Approved / Rejected / Frozen / Paid |
| Amount | OMR xxx.xxx |
| Clinic | `clinicName` |
| Date | `createdAt` |

**Removed:**
- ~~Employee Name~~

#### 7.1.5 Claims Detail Page (Tenant Admin)

**File:** `tenantapp/components/reimbursements/ReimbursementDetailPage.tsx`

**Change:** Remove employee name from the header and detail sections.

**What stays:**
- Claim number, status, amount, description
- Clinic name
- Receipt preview
- History timeline (status entries show actor role but not employee name)
- Action buttons (approve/reject/freeze/pay)

**What's removed:**
- ~~"Submitted by: Employee Name"~~
- ~~Employee name in header~~

### 7.2 Marketing Site (remedygcc-marketing)

#### 7.2.1 Login Page

**File:** `remedygcc-marketing/src/app/reimbursement/employee/EmployeeLoginForm.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/reimbursement/employee` |
| Purpose | Employee login |

**Form Fields:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Organization | Dropdown | Yes | Select from active tenants list |
| Email | Email input | Yes | Valid email format |
| Password | Password input | Yes | Non-empty |

**Buttons:**
| Button | Action |
|--------|--------|
| "Sign In" | Submit login |
| "Sign Up" | Navigate to `/reimbursement/employee/register` |

**States:**
| State | Behavior |
|-------|----------|
| Initial | Empty form, "Sign In" disabled |
| Submitting | Spinner on button, fields disabled |
| Error — Not Registered | "This account has not been registered yet. Please sign up first." + link to registration |
| Error — Invalid Credentials | "Invalid email or password. Please try again." |
| Error — Locked | "Too many attempts. Please try again later." |
| Error — Suspended | "This account has been suspended. Please contact your administrator." |
| Error — Inactive | "This account is no longer active." |
| Success | Redirect to portal |
| mustChangePassword | Redirect to change password page with prompt |

**Copy for "Sign Up" link:**
> Don't have an account? [Sign Up](#)

#### 7.2.2 Registration Page (NEW)

**File (NEW):** `remedygcc-marketing/src/app/reimbursement/employee/register/page.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/reimbursement/employee/register` |
| Purpose | Employee self-registration (set name, phone, password) |

**Form Fields:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Organization | Dropdown | Yes | Select from active tenants |
| Employee Code | Text input | Yes | Match what org provided |
| Email | Email input | Yes | Match what org provided |
| Full Name | Text input | Yes | 1-100 chars |
| Phone | Tel input | No | Optional |
| Password | Password input | Yes | Min 8 chars, uppercase, lowercase, digit |
| Confirm Password | Password input | Yes | Must match password |

**Buttons:**
| Button | Action |
|--------|--------|
| "Create Account" | Submit registration |
| "Sign In" | Navigate to login page |

**States:**
| State | Behavior |
|-------|----------|
| Initial | Empty form |
| Submitting | Spinner, fields disabled |
| Error — Not Found | "We couldn't find a matching invitation. Please check your details or contact your organization." |
| Error — Already Registered | "This account is already registered. Please sign in instead." |
| Error — Email Mismatch | "The email you entered doesn't match our records." |
| Error — Weak Password | "Password must be at least 8 characters with uppercase, lowercase, and a digit." |
| Error — Passwords Don't Match | "Passwords do not match." |
| Success | "Registration complete! Welcome, {name}." → redirect to portal |

**Copy for success:**
> **Welcome to Remedy!**
> Your account has been created. You can now submit and track your claims.

#### 7.2.3 Change Password Page (NEW)

**File (NEW):** `remedygcc-marketing/src/app/reimbursement/employee/change-password/page.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/reimbursement/employee/change-password` |
| Purpose | Change own password |

**Form Fields:**
| Field | Type | Required |
|-------|------|----------|
| Current Password | Password | Yes |
| New Password | Password | Yes |
| Confirm New Password | Password | Yes |

**Copy (shown when `mustChangePassword` is true):**
> Your password has been reset by an administrator. Please choose a new password to continue.

**Buttons:**
| Button | Action |
|--------|--------|
| "Update Password" | Submit change |

**States:**
| State | Behavior |
|-------|----------|
| Success | "Password updated successfully." → redirect to portal |
| Error — Wrong Current | "Current password is incorrect." |
| Error — Weak | Same as registration |

#### 7.2.4 Employee Portal

**File:** `remedygcc-marketing/src/app/reimbursement/portal/page.tsx`

**Changes:**
- Add "Change Password" link/action in the portal navigation or profile section
- Portal greeting still shows `session.employeeName` (employee sees own name)
- All other content unchanged

**New card/option:**
> **Account Settings**
> Update your profile and password.

#### 7.2.5 Claims List & Detail (Employee-facing)

**Files:**
- `ClaimsList.tsx`
- `ClaimDetail.tsx`
- `ClaimForm.tsx`

**No changes needed.** Employee-facing claim pages already show the employee's own name and data. These pages are not affected by the Tenant Admin anonymity rules.

### 7.3 Super Admin Dashboard (remedygcc-admin)

#### 7.3.1 Employee List Page (NEW)

**Files (NEW):**
- `remedygcc-admin/src/app/employees/page.tsx`
- `remedygcc-admin/src/app/employees/layout.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/employees` |
| Purpose | Cross-tenant employee management |
| Permission | Super Admin (`requireApiAuth`) |

**Table Columns:**
| Column | Notes |
|--------|-------|
| Name | |
| Email | |
| Employee Code | |
| Organization | Tenant name |
| Status | Badge: Not Registered / Active / Inactive / Suspended |
| Last Access | Relative time |
| Actions | Reset Password, Unlock, Suspend |

**Filters:**
- Search (name, email, employeeCode)
- Status dropdown
- Tenant dropdown

**States:**
| State | Behavior |
|-------|----------|
| Empty | "No employees found." |
| Error | Error banner with retry |

#### 7.3.2 Employee Detail Page (NEW)

**File (NEW):** `remedygcc-admin/src/app/employees/[id]/page.tsx`

| Aspect | Detail |
|--------|--------|
| Route | `/employees/[id]` |
| Purpose | Full employee detail and management actions |
| Permission | Super Admin |

**Displayed Fields:**
| Section | Fields |
|---------|--------|
| Profile | Name, Email, Employee Code, Phone, Organization |
| Status | Status (badge), Last Access, Created, Updated |
| Security | Failed Login Attempts, Locked Until, Must Change Password |

**Actions:**
| Button | API | Confirmation Required? |
|--------|-----|----------------------|
| Reset Password | `POST /api/super-admin/employees/[id]/reset-password` | Yes — "This will generate a temporary password and force the employee to change it on next login." |
| Unlock | `POST /api/super-admin/employees/[id]/unlock` | No |
| Suspend | `POST /api/super-admin/employees/[id]/suspend` | Yes — "This will prevent the employee from logging in." |
| Unsuspend | `POST /api/super-admin/employees/[id]/unsuspend` | No |

**Reset Password Flow:**
1. Super Admin clicks "Reset Password"
2. Confirmation modal appears
3. Super Admin confirms
4. Response shows temporary password in a modal with copy button + warning: "This password will only be shown once. Share it securely with the employee."
5. Modal has: "Copied" button + "Close" button

**States:**
| State | Behavior |
|-------|----------|
| Loading | Spinner |
| Not found | "Employee not found" |
| Error | Error banner |

#### 7.3.3 Sidebar Navigation

**File:** `remedygcc-admin/src/components/layout/Sidebar.tsx`

**Add menu item:**
```typescript
{ id: 'employees', label: 'Employees', path: '/employees', icon: Users }
```

**Existing menu items unchanged:**
- Dashboard
- Claims (unchanged — still shows `employeeName` for Super Admin)
- Tenants
- Clinics
- Settings
- Logs

---

## 8. Role Permissions Matrix

### 8.1 Employee Lifecycle

| Operation | Tenant Admin | Employee | Super Admin |
|-----------|:------------:|:--------:|:-----------:|
| Create employee (code + email) | **✓** | ✗ | **✓** |
| View employee list | **✓** (anonymous) | ✗ | **✓** (full) |
| View employee detail | **✓** (limited) | **✓** (self) | **✓** (full) |
| Edit employee (code, email) | **✓** | ✗ | **✓** |
| Edit employee name | ✗ | **✓** (self, during registration) | **✓** |
| Deactivate (→ inactive) | **✓** | ✗ | **✓** |
| Reactivate (→ active) | **✓** | ✗ | **✓** |
| Suspend (→ suspended) | ✗ | ✗ | **✓** |
| Unsuspend (→ active) | ✗ | ✗ | **✓** |
| Set own password | ✗ | **✓** (registration + change) | ✗ |
| Reset password (temp) | ✗ | ✗ | **✓** |
| Unlock account | ✗ | ✗ | **✓** |
| View name | ✗ | **✓** (self) | **✓** |
| View phone | ✗ | **✓** (self) | **✓** |
| View failed attempts / lockout | ✗ | ✗ | **✓** |
| Register account | ✗ | **✓** | ✗ |

### 8.2 Claim Visibility

| Detail | Tenant Admin | Employee | Super Admin |
|--------|:------------:|:--------:|:-----------:|
| View claim list | **✓** (no names) | **✓** (own only) | **✓** |
| View claim detail | **✓** (no names) | **✓** (own only) | **✓** |
| View employeeName on claim | ✗ | **✓** (own) | **✓** |
| View employeeCode on claim | **✓** | **✓** | **✓** |
| Approve claim | **✓** | ✗ | ✗ |
| Reject claim | **✓** | ✗ | ✗ |
| Freeze claim | **✓** | ✗ | ✗ |
| Pay claim | **✓** | ✗ | ✗ |
| Submit claim | ✗ | **✓** | ✗ |
| View receipt | **✓** | **✓** (own) | **✓** |

### 8.3 Future Roles (Not Implemented)

| Role | When |
|------|------|
| Clinic Staff | Future phase |
| Clinic Admin | Future phase |
| Organization Finance | Future phase |
| Organization Manager (limited claims) | Future phase |

---

## 9. Validation Rules

### 9.1 Employee Code

| Rule | Severity | Location |
|------|----------|----------|
| Required | Error | Client + Server |
| 1-50 characters | Error | Server |
| Alphanumeric, hyphens, underscores only | Error | Server |
| Unique within tenant | Error | DB (unique compound index) |

### 9.2 Email

| Rule | Severity | Location |
|------|----------|----------|
| Required | Error | Client + Server |
| Valid email format | Error | Client + Server |
| Max 255 characters | Error | Server |
| Stored lowercased | Convention | Server |

### 9.3 Password

| Rule | Severity | Location |
|------|----------|----------|
| Required | Error | Client + Server |
| Min 8 characters | Error | Client + Server |
| At least 1 uppercase letter | Error | Client + Server |
| At least 1 lowercase letter | Error | Client + Server |
| At least 1 digit | Error | Client + Server |
| Cannot be empty | Error | Client + Server |

### 9.4 Registration

| Rule | Severity | Location |
|------|----------|----------|
| Employee must exist in tenant | Error | Server |
| Email must match stored email | Error | Server |
| Status must be `not_registered` | Error | Server |
| Account must not be inactive/suspended | Error | Server |
| Name is required (1-100 chars) | Error | Client + Server |
| Password confirmation must match | Error | Client |

### 9.5 Duplicate Detection

| Scenario | Error Code | HTTP Status |
|----------|------------|:-----------:|
| Duplicate employeeCode in tenant | `DUPLICATE_CODE` | 409 |
| Duplicate email across platform | Soft warning (non-unique index) | — |
| Already registered | `ALREADY_REGISTERED` | 409 |

---

## 10. Error Handling

### 10.1 Error Codes

| Code | Meaning | HTTP Status | Where |
|------|---------|:-----------:|-------|
| `TENANT_NOT_FOUND` | Invalid or inactive tenant | 400/401 | Registration, Login |
| `EMPLOYEE_NOT_FOUND` | Employee record not found | 404 | Registration, Login |
| `EMAIL_MISMATCH` | Email doesn't match stored record | 400 | Registration |
| `ALREADY_REGISTERED` | Employee already completed registration | 409 | Registration |
| `ACCOUNT_NOT_AVAILABLE` | Employee is inactive or suspended | 403 | Registration, Login |
| `WEAK_PASSWORD` | Password fails strength check | 400 | Registration, Change Password |
| `INVALID_PASSWORD` | Current password is wrong | 401 | Login, Change Password |
| `NOT_REGISTERED` | Employee hasn't registered yet | 403 | Login |
| `EMPLOYEE_INACTIVE` | Employee is deactivated | 403 | Login |
| `EMPLOYEE_SUSPENDED` | Employee is suspended | 403 | Login |
| `EMPLOYEE_LOCKED` | Too many failed attempts | 429 | Login |
| `MUST_CHANGE_PASSWORD` | Password was reset by admin | 200 (flag) | Login |
| `DUPLICATE_CODE` | Employee code already in use | 409 | Create Employee |
| `SESSION_EXPIRED` | HMAC session expired | 401 | All authenticated routes |
| `NOT_AUTHENTICATED` | No valid session | 401 | All authenticated routes |

### 10.2 Error Response Shape

```json
{
  "success": false,
  "error": "Human-readable message shown to user.",
  "errorCode": "MACHINE_READABLE_CODE"
}
```

Success responses use `{ success: true, ...data }` for registration and login. Standard REST responses for CRUD endpoints.

### 10.3 HTTP Status Mapping

| Scenario | Status |
|----------|:------:|
| Success | 200 |
| Created | 201 |
| Validation Error | 400 |
| Unauthenticated | 401 |
| Forbidden (no permission) | 403 |
| Not Found | 404 |
| Conflict (duplicate) | 409 |
| Too Many Requests (locked) | 429 |
| Server Error | 500 |

---

## 11. UI Copy

### 11.1 Buttons

| Button | Page | Copy |
|--------|------|------|
| Login submit | Login | "Sign In" |
| Registration submit | Register | "Create Account" |
| Change password submit | Change Password | "Update Password" |
| Add employee | Tenant Admin List | "Add Employee" |
| Add employee submit | Tenant Admin Form | "Add Employee" |
| Cancel form | Any form | "Cancel" |
| Deactivate | Tenant Admin Detail | "Deactivate" |
| Reactivate | Tenant Admin Detail | "Reactivate" |
| View Claims | Tenant Admin Detail | "View Claims" |
| Reset Password | Super Admin Detail | "Reset Password" |
| Unlock | Super Admin Detail | "Unlock" |
| Suspend | Super Admin Detail | "Suspend" |
| Unsuspend | Super Admin Detail | "Unsuspend" |

### 11.2 Validation Messages

| Field | Message |
|-------|---------|
| Employee Code (empty) | "Employee code is required." |
| Employee Code (format) | "Use only letters, numbers, hyphens, and underscores." |
| Email (empty) | "Email is required." |
| Email (invalid) | "Please enter a valid email address." |
| Password (empty) | "Password is required." |
| Password (weak) | "Password must be at least 8 characters with uppercase, lowercase, and a digit." |
| Confirm Password (mismatch) | "Passwords do not match." |
| Name (empty) | "Full name is required." |
| Organization (empty) | "Please select your organization." |

### 11.3 Success Messages

| Action | Message |
|--------|---------|
| Employee created | "Employee added. They can now register via the employee portal." |
| Registration complete | "Welcome to Remedy! Your account has been created." |
| Password changed | "Password updated successfully." |
| Employee deactivated | "Employee deactivated." |
| Employee reactivated | "Employee reactivated." |
| Password reset (Super Admin) | "Temporary password generated. Share it securely with the employee." |
| Account unlocked | "Employee account unlocked." |
| Employee suspended | "Employee suspended." |
| Employee unsuspended | "Employee unsuspended." |

### 11.4 Error Messages (User-Facing)

| Error Code | Message |
|------------|---------|
| `TENANT_NOT_FOUND` | "Invalid organization. Please try again." |
| `EMPLOYEE_NOT_FOUND` | "We couldn't find a matching invitation. Please check your details or contact your organization." |
| `EMAIL_MISMATCH` | "The email you entered doesn't match our records." |
| `ALREADY_REGISTERED` | "This account has already been registered. Please sign in instead." |
| `WEAK_PASSWORD` | "Password must be at least 8 characters with uppercase, lowercase, and a digit." |
| `INVALID_PASSWORD` | "Invalid email or password." |
| `NOT_REGISTERED` | "This account has not been registered yet. Please sign up first." |
| `EMPLOYEE_INACTIVE` | "This account is no longer active. Please contact your organization." |
| `EMPLOYEE_SUSPENDED` | "This account has been suspended. Please contact your administrator." |
| `EMPLOYEE_LOCKED` | "Too many failed attempts. Please try again in 15 minutes." |
| `DUPLICATE_CODE` | "An employee with this code already exists." |
| Generic server error | "Something went wrong. Please try again." |

### 11.5 Empty States

| Page | Message |
|------|---------|
| Tenant Admin Employee List | "No employees yet. Add your first employee to get started." |
| Tenant Admin Claims List | "No claims found matching your filters." |
| Super Admin Employee List | "No employees found matching your search." |

---

## 12. Greenfield Context

This is a greenfield implementation.

There are zero existing employee accounts. The system starts directly with the new password-based model.

**Therefore:**
- No migration strategy is required.
- No rollback strategy is required.
- No PIN-to-password conversion is required.
- No backward compatibility with PIN auth is required.
- No temporary passwords for existing users are required.
- No `_pinHashBackup` or legacy data fields are required.
- No coexistence window is required.

Registration is the only onboarding path. Every employee follows the same flow: Tenant Admin creates a placeholder (code + email, status `not_registered`) → Employee visits portal → Signs up with their own password → Becomes Active.

---

## 13. Testing Strategy

### 13.1 Unit Tests

| Suite | File | Tests |
|-------|------|-------|
| Password hashing | `employee-access.test.ts` | `hashPassword` produces valid bcrypt hash, `verifyPassword` matches, wrong password fails |
| Password strength | `employee-access.test.ts` | Rejects short, no-upper, no-lower, no-digit passwords. Accepts valid. |
| Registration | `employee-crud.test.ts` | Registers with valid data, rejects wrong email, rejects already registered, rejects inactive/suspended |
| Login | `employee-access.test.ts` | Email+password success, wrong password fails, lockout after N attempts, `mustChangePassword` flag returned |
| Password change | `employee-access.test.ts` | Changes password, rejects wrong current, verifies new password works for login |
| Status transitions | `employee-crud.test.ts` | Admin creates employee (not_registered), employee registers (active), admin deactivates (inactive), super admin suspends (suspended) |
| Visibility filtering | `employee-crud.test.ts` | Tenant admin cannot see `name`, Super Admin can see `name` |

### 13.2 Integration Tests

| Suite | What it covers |
|-------|----------------|
| Registration API | `POST /api/employee/register` — success path, each error path |
| Login API | `POST /api/employee/login` — tenant-scoped email+password login, org resolution, all error codes |
| Change Password API | `POST /api/employee/change-password` — auth required, success, wrong current |
| Super Admin APIs | All 6 new endpoints — auth, success, error paths |
| Tenant Admin APIs | Updated endpoints — `name` stripped, registration-only, PIN removed |
| Claim visibility | `GET /api/reimbursements` — `employeeName` present for super admin, absent for tenant admin |

### 13.3 Permission Tests

| Test | What it verifies |
|------|------------------|
| Tenant Admin cannot reset password | `POST /api/employees/[id]/reset-pin` returns 404 (removed) |
| Tenant Admin cannot unlock | `POST /api/employees/[id]/unlock` returns 404 (removed) |
| Super Admin can unlock | `POST /api/super-admin/employees/[id]/unlock` returns 200 |
| Super Admin can reset password | Returns temp password + `mustChangePassword` |
| Employee can change own password | Authenticated request succeeds |
| Unauthenticated employee cannot change password | Returns 401 |

### 13.4 UI Tests (Manual or Playwright)

| Screen | What to verify |
|--------|----------------|
| Tenant Employee List | No name column, search works on code/email |
| Tenant Employee Form | No name/password field, code+email only |
| Tenant Employee Detail | No name, no PIN actions |
| Tenant Claims List | No employee name column |
| Employee Login | Email+password fields, org selector, sign up link |
| Employee Registration | Full form, validation, success flow |
| Employee Change Password | Current + new password flow |
| Super Admin Employee List | Name visible, all filters work |
| Super Admin Employee Detail | Full profile, all actions work |
| Super Admin Reset Password | Temp password shown once, `mustChangePassword` works |

### 13.6 Regression Tests

- Full claim lifecycle (create → approve → reject → freeze → pay) — no changes expected
- Survey/scanner functionality — unaffected
- Tenant dashboard login/logout — unaffected
- Super Admin login/logout — unaffected
- Receipt upload flow — unaffected (just auth changes)

---

## 14. Implementation Roadmap

### Implementation Rules

1. **Follow the roadmap sequentially.** Steps build on each other. Do not skip ahead.
2. **Keep commits focused.** Each step should produce compilable, working code. Avoid mixing changes from different steps in a single commit.
3. **Do not redesign the architecture during implementation.** If a design issue is discovered, document it separately for future phases and work around it using the existing architecture.
4. **Preserve API contracts.** DTOs defined in Section 6.4.0 are frozen. Frontend and backend implementations must match them exactly. Any deviation requires updating this document before code is merged.
5. **Every step must pass linting, type checking, and tests.** No step is complete until all three pass.
6. **No feature creep.** If a feature is not in this document, it does not belong in Phase 1. Log it for a future phase and move on.
7. **Cross-app coordination.** When an API changes, the consuming frontend must be updated in the same deployment cycle. Use feature flags if needed.
8. **Any architectural deviation must be documented.** If a genuine implementation blocker forces a change to this blueprint, the change must be written down with rationale before implementation continues.

### Step 1: Data Model

**Duration:** 0.5 day  
**Files:** `tenantapp/src/server/db/documents.ts`

**Tasks:**
- [ ] Expand `EmployeeDocument.status` union
- [ ] Replace `pinHash: string` with `passwordHash: string | null`
- [ ] Add `mustChangePassword: boolean`
- [ ] Add `phoneNumber?: string`
- [ ] Expand `AuditEventDocument.action`
- [ ] Update `SafeEmployee` / `SafeEmployeeDocument` types

**Output:** Updated type definitions.

### Step 2: Repository

**Duration:** 0.5 day  
**Dependency:** Step 1  
**Files:** `contracts.ts`, `employeesRepository.ts`, `memoryRepositoryContext.ts`

**Tasks:**
- [ ] Add `findByTenantAndEmail()` to contract interface
- [ ] Implement `findByTenantAndEmail()` in MongoDB repository
- [ ] Add `{ tenantId: 1, email: 1 }` compound index
- [ ] Implement `findByTenantAndEmail()` in memory repository
- [ ] Update seed data (remove PIN hash, add known bcrypt password hash)

**Output:** Repository layer updated. Migration-index ready.

### Step 3: Employee Service

**Duration:** 2 days  
**Dependency:** Step 2  
**File:** `tenantapp/src/server/services/employeeService.ts`

**Tasks:**
- [ ] Add `hashPassword()`, `verifyPassword()` (bcrypt)
- [ ] Add `validatePasswordStrength()`
- [ ] Add `registerEmployee()` — full registration flow
- [ ] Add `changePassword()` — authenticated password change
- [ ] Modify `loginEmployee()` — accept email + password
- [ ] Modify `createEmployee()` — code + email only, status `not_registered`
- [ ] Modify `listEmployees()` — add `callerRole` param, filter `name`
- [ ] Modify `getEmployee()` — role-aware filtering
- [ ] Add `resetEmployeePassword()` — Super Admin generates temp password
- [ ] Add `suspendEmployee()` / `unsuspendEmployee()`
- [ ] Remove 6 PIN functions
- [ ] Update `SafeEmployee`, `LoginResult`, `LoginErrorCode` types
- [ ] Update constants (`MIN_PASSWORD_LENGTH`)

**Output:** Complete service rewrite, ready for API layer.

### Step 4: Tenant Admin APIs

**Duration:** 1 day  
**Dependency:** Step 3  
**Files:**
- `tenantapp/app/api/employees/route.ts`
- `tenantapp/app/api/employees/[id]/route.ts`
- DELETE `tenantapp/app/api/employees/[id]/unlock/route.ts`
- DELETE `tenantapp/app/api/employees/[id]/reset-pin/route.ts`

**Tasks:**
- [ ] Update `POST /api/employees` — request body, validation, response
- [ ] Update `GET /api/employees` — strip `name` from response
- [ ] Update `GET /api/employees/[id]` — strip identity fields
- [ ] Update `PUT /api/employees/[id]` — remove PIN update, restrict fields
- [ ] Delete unlock route
- [ ] Delete reset-pin route

**Output:** Tenant admin employee APIs updated. PIN routes removed.

### Step 5: Claim Visibility Filtering

**Duration:** 0.5 day  
**Dependency:** Step 3  
**Files:**
- `tenantapp/app/api/reimbursements/route.ts`
- `tenantapp/app/api/reimbursements/[id]/route.ts`
- `tenantapp/app/api/admin/reimbursements/route.ts`

**Tasks:**
- [ ] Detect caller role in `admin/reimbursements` (API key vs tenant session)
- [ ] Strip `employeeName` from list and detail responses for Tenant Admin callers
- [ ] Preserve `employeeName` for Super Admin

**Output:** Claims API respects anonymity.

### Step 6: Employee-Facing APIs

**Duration:** 1 day  
**Dependency:** Step 3  
**Files:**
- `tenantapp/app/api/employee/login/route.ts`
- `tenantapp/app/api/employee/me/route.ts`
- NEW `tenantapp/app/api/employee/register/route.ts`
- NEW `tenantapp/app/api/employee/change-password/route.ts`

**Tasks:**
- [ ] Rewrite login — tenantSlug + email + password, tenant-scoped lookup via `findByTenantAndEmail()`
- [ ] Create registration endpoint — full flow
- [ ] Create change-password endpoint
- [ ] Update /me — add `mustChangePassword`

**Output:** Employee-facing auth APIs complete.

### Step 7: Super Admin APIs

**Duration:** 1 day  
**Dependency:** Step 3  
**Files (NEW):**
- `tenantapp/app/api/super-admin/employees/route.ts`
- `tenantapp/app/api/super-admin/employees/[id]/route.ts`
- `tenantapp/app/api/super-admin/employees/[id]/reset-password/route.ts`
- `tenantapp/app/api/super-admin/employees/[id]/unlock/route.ts`
- `tenantapp/app/api/super-admin/employees/[id]/suspend/route.ts`
- `tenantapp/app/api/super-admin/employees/[id]/unsuspend/route.ts`

**Tasks:**
- [ ] Create cross-tenant employee list (full visibility)
- [ ] Create employee detail (full profile)
- [ ] Create reset-password (temp password + mustChangePassword)
- [ ] Create unlock (moved from tenant admin)
- [ ] Create suspend/unsuspend

**Output:** Super Admin employee management APIs.

### Step 8: Marketing Site Server

**Duration:** 1 day  
**Dependency:** Step 6  
**Files:**
- `remedygcc-marketing/src/lib/employee-access/session.ts`
- `remedygcc-marketing/src/types/employee-access.ts`
- `remedygcc-marketing/src/app/api/employee-access/login/route.ts`
- NEW `remedygcc-marketing/src/app/api/employee-access/register/route.ts`
- NEW `remedygcc-marketing/src/app/api/employee-access/change-password/route.ts`

**Tasks:**
- [ ] Update login types (`LoginRequest`, `LoginResponse`)
- [ ] Rewrite login proxy — tenantSlug + email + password, new error codes
- [ ] Create registration proxy
- [ ] Create change-password proxy
- [ ] Update session library if needed (minimal — only login call changes)

**Output:** Marketing site proxies updated.

### Step 9: Marketing Site UI

**Duration:** 1.5 days  
**Dependency:** Step 8  
**Files:**
- `remedygcc-marketing/src/app/reimbursement/employee/EmployeeLoginForm.tsx`
- NEW `remedygcc-marketing/src/app/reimbursement/employee/register/page.tsx`
- NEW `remedygcc-marketing/src/app/reimbursement/employee/change-password/page.tsx`
- `remedygcc-marketing/src/app/reimbursement/portal/page.tsx`

**Tasks:**
- [ ] Redesign login form (Organization dropdown + email + password — org is required)
- [ ] Create registration page (organization, code, email, name, phone, password, confirm)
- [ ] Create change password page (current, new, confirm)
- [ ] Add "Change Password" link to portal
- [ ] Add "mustChangePassword" redirect to login flow
- [ ] Add error state handling for all new error codes

**Output:** Employee-facing UI updated with registration and password change.

### Step 10: Tenant Dashboard UI

**Duration:** 1.5 days  
**Dependency:** Step 4  
**Files:**
- `tenantapp/components/employees/EmployeeListPage.tsx`
- `tenantapp/components/employees/EmployeeFormPage.tsx`
- `tenantapp/components/employees/EmployeeDetailPage.tsx`
- `tenantapp/components/reimbursements/ReimbursementListPage.tsx`
- `tenantapp/components/reimbursements/ReimbursementDetailPage.tsx`

**Tasks:**
- [ ] Remove `name` column from employee list table
- [ ] Remove name from search scope
- [ ] Simplify employee form (code + email only, no name, no password)
- [ ] Simplify employee detail (no name, no PIN actions, deactivate only)
- [ ] Remove `employeeName` from claims list table
- [ ] Remove `employeeName` from claims detail view
- [ ] Add "Not Registered" status badge styling
- [ ] Add "Suspended" status badge styling

**Output:** Tenant dashboard respects anonymity and removed PIN actions.

### Step 11: Super Admin Dashboard UI

**Duration:** 1.5 days  
**Dependency:** Step 7  
**Files (NEW):**
- `remedygcc-admin/src/app/employees/page.tsx`
- `remedygcc-admin/src/app/employees/layout.tsx`
- `remedygcc-admin/src/app/employees/[id]/page.tsx`
- `remedygcc-admin/src/components/layout/Sidebar.tsx` (add nav item)

**Tasks:**
- [ ] Create employee list page (cross-tenant, full visibility)
- [ ] Create employee detail page (full profile)
- [ ] Implement Reset Password action with confirmation modal + one-time password display
- [ ] Implement Unlock action
- [ ] Implement Suspend/Unsuspend actions
- [ ] Add "Employees" to sidebar navigation

**Output:** Super Admin employee management UI.

### Step 12: Tests

**Duration:** 2 days  
**Dependency:** Steps 3-7  
**Files:**
- `tenantapp/src/server/services/__tests__/employee-crud.test.ts`
- `tenantapp/src/server/services/__tests__/employee-access.test.ts`
- `tenantapp/src/server/services/__tests__/reimbursement-crud.test.ts`
- `tenantapp/scripts/verify-employees.mjs`

**Tasks:**
- [ ] Rewrite employee CRUD tests for new lifecycle
- [ ] Rewrite employee access tests for password auth
- [ ] Add registration tests
- [ ] Add password change tests
- [ ] Add visibility filtering tests
- [ ] Update reimbursement tests for name filtering
- [ ] Full regression run

**Output:** Comprehensive test suite.

### Step 13: Regression + Deploy

**Duration:** 1 day  
**Dependency:** Steps 4-12  

**Tasks:**
- [ ] Deploy `tenantapp` backend
- [ ] Deploy `remedygcc-marketing` backend + UI
- [ ] Deploy `remedygcc-admin` backend + UI
- [ ] Verify all three apps + all UIs
- [ ] Run full E2E tests on staging
- [ ] Deploy to production
- [ ] Monitor error rates for first hour

**Output:** Phase 1 deployed.

### Timeline

```
Week 1:
  Mon: Step 1 (model) + Step 2 (repos)
  Tue: Step 3 (service rewrite)
  Wed: Step 3 (cont.)
  Thu: Step 4 (tenant APIs) + Step 5 (claim filter) + Step 6 (employee APIs)
  Fri: Step 7 (super admin APIs) + Step 8 (marketing server)

Week 2:
  Mon: Step 9 (marketing UI) + Step 10 (tenant UI)
  Tue: Step 9 + Step 10 (cont.) + Step 11 (super admin UI)
  Wed: Step 11 (cont.)
  Thu: Step 12 (tests)
  Fri: Step 13 (deploy)
```

**Total: ~12-14 developer-days across 2 weeks.**

---

## 15. Future Phases

These are explicitly NOT implemented in Phase 1. They are documented here to ensure the Phase 1 architecture supports them.

| Feature | Phase | Why Deferred |
|---------|-------|--------------|
| **Forgot Password** | Phase 2 | Requires email infrastructure (SMTP, templates, sending). Phase 1 handles password changes for authenticated users and Super Admin resets. |
| **CSV Upload** | Phase 2 | Batch operations need background job infrastructure, file parsing, progress tracking. Phase 1 manual creation is sufficient. |
| **Email Invitations** | Phase 2 | Requires email infrastructure. Phase 1 employees are created manually by Tenant Admin. |
| **AuthorizedEmployeeEntry** | Phase 2 | New entity justified when CSV upload needs a pre-account authorization state. Phase 1 uses `EmployeeDocument.status: "not_registered"`. |
| **Notifications** | Phase 2+ | Event system, email/SMS sending. Not required for Phase 1 flows. |
| **Email Verification** | Phase 2+ | Adds state machine complexity. Not required — trust model is org-verified. |
| **JWT / Access Tokens** | Phase 3+ | Current HMAC cookies work correctly. JWT needed when mobile apps or cross-origin auth is required. |
| **Platform-Wide User Entity** | Phase 3+ | Employee stays tenant-scoped in Phase 1. Platform identity needed when clinic portal or multi-org accounts are built. |
| **Multi-Organization Identity** | Phase 3+ | No current requirement for employees belonging to multiple orgs. |
| **Claims Model Rename** | Phase 3+ | Renaming `ReimbursementDocument` → `Claim` is cosmetic. Large refactoring cost for zero behavioral change. |
| **Clinic Portal** | Phase 3+ | Clinic model is out of scope for identity refactor. |
| **Budget / Invoicing** | Phase 3+ | Financial infrastructure. No current client requirement. |
| **Department Model** | Future | Not scoped. |
| **Phone as Identifier** | Future | Not scoped. |

---

## Appendix A: File Change Summary

### Modified (19 files)

| # | Path | Change |
|---|------|--------|
| 1 | `tenantapp/src/server/db/documents.ts` | EmployeeDocument fields, AuditEventDocument actions |
| 2 | `tenantapp/src/server/repositories/contracts.ts` | Add `findByTenantAndEmail` to interface |
| 3 | `tenantapp/src/server/repositories/employeesRepository.ts` | Add `findByTenantAndEmail`, add compound index |
| 4 | `tenantapp/src/server/repositories/memoryRepositoryContext.ts` | Add `findByTenantAndEmail`, update seed data |
| 5 | `tenantapp/src/server/services/employeeService.ts` | 6 remove, 5 add, 5 modify |
| 6 | `tenantapp/app/api/employees/route.ts` | POST simplified, GET strips name |
| 7 | `tenantapp/app/api/employees/[id]/route.ts` | GET strips identity, PUT no PIN |
| 8 | `tenantapp/app/api/employee/login/route.ts` | Accept email+password |
| 9 | `tenantapp/app/api/employee/me/route.ts` | Add `mustChangePassword` |
| 10 | `tenantapp/app/api/reimbursements/route.ts` | Strip `employeeName` for tenant admin |
| 11 | `tenantapp/app/api/reimbursements/[id]/route.ts` | Strip `employeeName` for tenant admin |
| 12 | `tenantapp/app/api/admin/reimbursements/route.ts` | Role-aware response |
| 13 | `remedygcc-marketing/src/types/employee-access.ts` | Update types for login/registration |
| 14 | `remedygcc-marketing/src/lib/employee-access/session.ts` | No structural changes |
| 15 | `remedygcc-marketing/src/app/api/employee-access/login/route.ts` | Email+password proxy |
| 16 | `remedygcc-marketing/src/app/reimbursement/employee/EmployeeLoginForm.tsx` | Redesign form |
| 17 | `remedygcc-marketing/src/app/reimbursement/portal/page.tsx` | Add change password link |
| 18 | `tenantapp/components/employees/EmployeeListPage.tsx` | Remove name, simplified form |
| 19 | `tenantapp/components/employees/EmployeeDetailPage.tsx` | Remove name, PIN actions |

### Modified (continued — component files)

| # | Path | Change |
|---|------|--------|
| 20 | `tenantapp/components/employees/EmployeeFormPage.tsx` | Code + email only |
| 21 | `tenantapp/components/reimbursements/ReimbursementListPage.tsx` | Remove `employeeName` column |
| 22 | `tenantapp/components/reimbursements/ReimbursementDetailPage.tsx` | Remove employee identity display |
| 23 | `remedygcc-admin/src/components/layout/Sidebar.tsx` | Add Employees nav item |

### New (15 files)

| # | Path | Purpose |
|---|------|---------|
| 1 | `tenantapp/app/api/employee/register/route.ts` | Employee registration endpoint |
| 2 | `tenantapp/app/api/employee/change-password/route.ts` | Employee change password endpoint |
| 3 | `tenantapp/app/api/super-admin/employees/route.ts` | SA: cross-tenant list |
| 4 | `tenantapp/app/api/super-admin/employees/[id]/route.ts` | SA: full detail |
| 5 | `tenantapp/app/api/super-admin/employees/[id]/reset-password/route.ts` | SA: reset password |
| 6 | `tenantapp/app/api/super-admin/employees/[id]/unlock/route.ts` | SA: unlock (moved) |
| 7 | `tenantapp/app/api/super-admin/employees/[id]/suspend/route.ts` | SA: suspend |
| 8 | `tenantapp/app/api/super-admin/employees/[id]/unsuspend/route.ts` | SA: unsuspend |
| 9 | `remedygcc-marketing/src/app/api/employee-access/register/route.ts` | Registration proxy |
| 10 | `remedygcc-marketing/src/app/api/employee-access/change-password/route.ts` | Change password proxy |
| 11 | `remedygcc-marketing/src/app/reimbursement/employee/register/page.tsx` | Registration page |
| 12 | `remedygcc-marketing/src/app/reimbursement/employee/change-password/page.tsx` | Change password page |
| 13 | `remedygcc-admin/src/app/employees/page.tsx` | SA: employee list UI |
| 14 | `remedygcc-admin/src/app/employees/layout.tsx` | SA: auth layout |
| 15 | `remedygcc-admin/src/app/employees/[id]/page.tsx` | SA: employee detail UI |

### Deleted (2 files)

| # | Path | Reason |
|---|------|--------|
| 1 | `tenantapp/app/api/employees/[id]/unlock/route.ts` | Moved to Super Admin |
| 2 | `tenantapp/app/api/employees/[id]/reset-pin/route.ts` | PIN removed |

**Total: 23 modified + 15 new + 2 deleted = 40 files touched**

## Appendix B: Environment Variables

| Variable | Status | Purpose |
|----------|--------|---------|
| `EMPLOYEE_SESSION_SECRET` | **Kept** | HMAC signing (unchanged) |
| `ADMIN_API_KEY` | **Kept** | Server-to-server auth (unchanged) |
| `TENANT_APP_URL` | **Kept** | Proxy target (unchanged) |

No new environment variables in Phase 1.

## Appendix C: Package Dependencies

| Package | Action | Purpose |
|---------|--------|---------|
| `bcrypt-ts` or `bcrypt` | **ADD** | Password hashing (replaces Node `crypto.scryptSync`) |
| `crypto` (Node built-in) | **KEEP** | Still used for `randomUUID`, `randomBytes` |

No other dependency changes.
