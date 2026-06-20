# Reimbursement Prototype — Reference Document

> Extracted from the deleted prototype that coupled reimbursements to clinic-owned employees.
> All business logic is sound; the architecture was wrong. Use this to rebuild under the correct
> **Tenant → Employee → Reimbursement + Clinic** model.

---

## 1. Reimbursement State Machine

### Allowed Status Transitions

```
                   ┌──────────┐
                   │  Pending │
                   └────┬─────┘
                      /     \
                 approve    reject
                   /           \
            ┌───────┴──┐    ┌──┴────────┐
            │ Approved │    │  Rejected │
            └───────┬──┘    └───┬───────┘
                   /            │
           mark paid         reject
                 /              │
          ┌─────┴───┐          │
          │   Paid  │          │
          └─────────┘          │
                    ┌──────────┘
                    │
               Terminal states:
               Paid & Rejected
```

**Validation rule** — applied before any other update:

```typescript
const allowedNext: Record<string, string[]> = {
  pending: ['approved', 'rejected'],
  approved: ['paid', 'rejected'],
  rejected: [],
  paid: [],
};

if (!(allowedNext[current.status] ?? []).includes(data.status)) {
  throw new Error(`Cannot transition from "${current.status}" to "${data.status}".`);
}
```

### Business Rules

| Rule | Detail |
|---|---|
| **Immutability after terminal** | Once `paid` or `rejected`, no further status changes allowed |
| **Review trail** | `reviewedBy` and `reviewedAt` are set alongside status transitions, not as separate steps |
| **Delete policy** | Only `pending` and `rejected` reimbursements can be deleted. Approved/paid are immutable records |
| **Amount rounding** | `Math.round(amount * 100) / 100` — 2 decimal places, applied on both create and update |
| **Employee name denormalized** | Employee name is resolved at creation and stored on the document (survives future employee record changes) |
| **Atomic transition + notes** | Status update and reviewer notes are sent in the same API call, never split |

### Validation Rules

| Field | Rule | Error if violated |
|---|---|---|
| `amount` | Must be a `number`, not NaN | `"Amount must be a number."` |
| `amount` | Must be > 0 | `"Amount must be greater than zero."` |
| `amount` | Must be ≤ 999,999,999 | `"Amount is too large."` |
| `description` | Required (non-empty after trim) | `"Description is required."` |
| `description` | Max 2000 characters | `"Description must be at most 2000 characters."` |

**Validation pattern** — every validator follows `(value) => string | null`:
- Returns `null` when valid
- Returns an error message string when invalid
- Called on both create and update paths

---

## 2. Schema Lessons

### What the Prototype Had

```typescript
interface ReimbursementDocument {
  id: string;            // "reimb_{timestamp36}_{random4}"
  clinicId: string;      // ❌ Primary ownership — wrong
  employeeId: string;    // ❌ References clinic-owned employees — wrong
  employeeName?: string; // ⚠️ Good denormalization, wrong source
  amount: number;        // ✅
  description: string;   // ✅
  category?: string;     // ✅ Enum-like: transport, medical, supplies, wellness, training, other
  status: ReimbursementStatus;  // ✅
  documentUrl?: string;  // ✅ Receipt / attachment
  reviewedBy?: string;   // ✅ Admin who processed
  reviewedAt?: string;   // ✅ Timestamp of review
  notes?: string;        // ✅ Reviewer notes / rejection reason
  createdAt: string;     // ✅
  updatedAt: string;     // ✅
}
```

### Recommended Schema

```typescript
interface Reimbursement {
  // Identity
  id: string;
  tenantId: string;       // The organization the employee belongs to
  employeeId: string;     // The employee (now tenant-owned)
  clinicId?: string;      // OPTIONAL — the clinic/provider where service occurred

  // Denormalized lookups (resolved at creation, then immutable)
  employeeName: string;
  clinicName?: string;
  clinicSlug?: string;

  // Financial
  amount: number;
  description: string;
  category?: 'transport' | 'medical' | 'supplies' | 'wellness' | 'training' | 'other';

  // Evidence
  documentUrl?: string;

  // Workflow
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;

  // Audit
  createdAt: string;
  updatedAt: string;
}
```

### Key Schema Decisions for the New Model

| Decision | Rationale |
|---|---|
| **`tenantId` primary** | The tenant owns the reimbursement workflow; reimbursements are an employee benefit, not a clinic feature |
| **`clinicId` optional** | Not all reimbursements involve a clinic visit (e.g., wellness purchases, training materials) |
| **Employee name denormalized** | The reimbursement is a financial record — it must survive employee record changes or deletion |
| **Clinic name/slug denormalized** | The clinic directory entry is separate from the reimbursement trail; don't JOIN at read time |
| **Category as fixed union** | Admin can expand later; start with the known set from the prototype |

---

## 3. Reusable UI Patterns

### 3a. Status Badge

A compact badge with icon, color, and background extracted from the status meta helper.

```tsx
function ReimbursementStatusBadge({ status }: { status: ReimbursementStatus }) {
  const meta = getReimbursementStatusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}
```

**Status meta helper (copy verbatim):**

```typescript
function getReimbursementStatusMeta(status: ReimbursementStatus): {
  label: string;
  color: string;
  bg: string;
  icon: string;
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: '#b45309', bg: 'rgba(245, 158, 11, 0.12)', icon: '⏳' };
    case 'approved':
      return { label: 'Approved', color: '#15803d', bg: 'rgba(34, 197, 94, 0.12)', icon: '✅' };
    case 'rejected':
      return { label: 'Rejected', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.1)', icon: '❌' };
    case 'paid':
      return { label: 'Paid', color: '#1d4ed8', bg: 'rgba(59, 130, 246, 0.12)', icon: '💰' };
  }
}
```

### 3b. Workflow Action Buttons

Conditional rendering based on current status:

```
[Pending]    → [Approve] [Reject]
[Approved]   → [Mark as Paid]
[Rejected]   → [Delete] (optional)
[Paid]       → (no actions)
```

```tsx
<div className="flex items-center gap-1">
  {item.status === 'pending' && (
    <>
      <button onClick={() => onAction(item.id, 'approved')}
        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Approve">
        <CheckCircle2 className="h-4 w-4" />
      </button>
      <button onClick={() => onAction(item.id, 'rejected')}
        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Reject">
        <XCircle className="h-4 w-4" />
      </button>
    </>
  )}
  {item.status === 'approved' && (
    <button onClick={() => onAction(item.id, 'paid')}
      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Mark as Paid">
      <DollarSign className="h-4 w-4" />
    </button>
  )}
</div>
```

### 3c. Statistics Cards

Compact 4-column stat bar using the same status colors:

```tsx
function ReimbursementStatsBar({ stats }: {
  stats: { pending: number; approved: number; paid: number; total: number }
}) {
  const cards = [
    { label: 'Pending', value: stats.pending,
      bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', desc: 'text-orange-600' },
    { label: 'Approved', value: stats.approved,
      bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', desc: 'text-green-600' },
    { label: 'Paid', value: stats.paid,
      bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', desc: 'text-blue-600' },
    { label: 'Total', value: stats.total,
      bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', desc: 'text-gray-600' },
  ];
  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-lg ${c.bg} border ${c.border} p-2.5 text-center`}>
          <p className={`text-lg font-bold ${c.text}`}>{c.value}</p>
          <p className={`text-xs ${c.desc}`}>{c.label}</p>
        </div>
      ))}
    </div>
  );
}
```

### 3d. Form UX Patterns

| Pattern | Detail |
|---|---|
| **Employee dropdown** | Filter to active employees only: `employees.filter(e => e.status === 'active')` |
| **Amount input** | `type="number" step="0.01" min="0"` — browser-level validation |
| **Category selector** | `<select>` with "No category" as default, then enumerated options |
| **Inline panel form** | Form slides into the section, cancel resets state. Avoids modal overhead |
| **Lazy employee load** | Load employees in parallel with reimbursement list via `Promise.all` |

---

## 4. Reusable Service Patterns

### 4a. Aggregation — Stats by Status

```typescript
async function getReimbursementStats(tenantId: string): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  paid: number;
}> {
  const [total, pending, approved, rejected, paid] = await Promise.all([
    countReimbursements(tenantId),
    countReimbursementsByStatus(tenantId, 'pending'),
    countReimbursementsByStatus(tenantId, 'approved'),
    countReimbursementsByStatus(tenantId, 'rejected'),
    countReimbursementsByStatus(tenantId, 'paid'),
  ]);
  return { total, pending, approved, rejected, paid };
}
```

**Repository helpers:**

```javascript
// db.reimbursements.countDocuments({ tenantId: __payload.tenantId })
// db.reimbursements.countDocuments({ tenantId: __payload.tenantId, status: __payload.status })
```

**Index:** `{ tenantId: 1, status: 1 }` covers both queries.

### 4b. Status Update Routing

The API route detects "status-only" payloads and routes to a dedicated handler, keeping full-update and status-transition logic separate:

```typescript
// In PUT /api/super-admin/reimbursements/[id]:
if (body.status && Object.keys(body).length <= 3) {
  const item = await updateReimbursementStatus(id, body.status, body.reviewedBy, body.notes);
  return NextResponse.json(item);
}
// Otherwise do a full update
const item = await updateReimbursementRecord(id, body);
```

The dedicated handler only touches status-related fields:

```typescript
async function updateReimbursementStatus(
  id: string,
  status: ReimbursementStatus,
  reviewedBy?: string,
  notes?: string,
): Promise<Reimbursement> {
  return updateReimbursementRecord(id, {
    status,
    reviewedBy: reviewedBy ?? null,
    reviewedAt: new Date().toISOString(),
    notes: notes ?? null,
  });
}
```

### 4c. Entity ID Generation

```typescript
function createReimbursementId(): string {
  return `reimb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
// Example: "reimb_1x2y3z_a1b2"
```

Follows the same convention as existing entities (`clinic-{slug}-{ts36}`, `emp_{ts36}_{random4}`). Human-readable prefix, timestamp for sort prefix, random tail for uniqueness.

### 4d. Query Patterns

| Query | Use case | Recommended index |
|---|---|---|
| `find({ tenantId }).sort({ createdAt: -1 })` | List all for a tenant | `{ tenantId: 1, createdAt: -1 }` |
| `find({ tenantId, status }).sort({ createdAt: -1 })` | Status-filtered view | `{ tenantId: 1, status: 1, createdAt: -1 }` |
| `countDocuments({ tenantId })` | Stats total | Covered by compound |
| `countDocuments({ tenantId, status })` | Stats per-status | Covered by compound |
| `find({ employeeId }).sort({ createdAt: -1 })` | Employee history | `{ employeeId: 1, createdAt: -1 }` |

---

## 5. Recommended New Architecture

```
Tenant (Omantel, OQ, PDO, ...)
  └── Employee
        └── Reimbursement   ← owned here

Clinic (Eunoia, Hayat, ...)
  └── Service Provider Info ← directory, not ownership

Reimbursement connects both:
  ┌─────────────────────────────────┐
  │  tenantId    → who owns it      │
  │  employeeId  → who claimed it   │
  │  clinicId?   → where it happened│  (optional)
  │  amount      → what it cost     │
  │  status      → where in workflow│
  └─────────────────────────────────┘
```

### File layout for future implementation

```
src/modules/reimbursement/
  ├── index.ts
  ├── types.ts                    — Reimbursement, DTOs, status/category types
  ├── utils.ts                    — validators, status meta, ID gen
  ├── service.ts                  — server-only business layer
  └── components/
      ├── index.ts
      ├── ReimbursementPanel.tsx  — mounts on Tenant detail page
      ├── ReimbursementStatusBadge.tsx
      ├── ReimbursementStatsBar.tsx
      └── ReimbursementForm.tsx

src/server/reimbursement/repository.ts
src/services/reimbursement-service.ts
src/app/api/super-admin/reimbursements/route.ts
src/app/api/super-admin/reimbursements/[id]/route.ts
```

### Integration point

Mount on the **Tenant detail page** (`/tenants/[id]`), not the clinic page:

```tsx
// In tenant detail page:
<ReimbursementPanel tenantId={tenant.id} />
```

Inside the panel, load employees from the tenant's employee list:

```tsx
const { data: employees } = await employeeService.listByTenant(tenantId);
```

The `clinicId` is an optional detail field — a lookup reference, not an ownership key.

---

## Summary — What to Keep vs Rewrite

| Action | Items |
|---|---|
| **Copy verbatim** | Status transition machine, amount/description validators, ID generator, `getReimbursementStatusMeta()`, stats aggregation pattern, status-only update routing |
| **Copy with field rename** | Service CRUD (replace `clinicId` → `tenantId`), UI panel (change prop from `clinicId` to `tenantId`), API routes (change query param) |
| **Rewrite** | Employee lookup — change from `getEmployeesByClinic(id)` to `getEmployeesByTenant(id)`; employee dropdown data source |
| **Discard entirely** | `clinicId` as primary ownership key; dynamic import of `@/server/employee/repository`; any panel mounted on clinic detail page |
