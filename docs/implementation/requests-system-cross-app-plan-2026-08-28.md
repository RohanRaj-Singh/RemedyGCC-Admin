# RemedyGCC — Global Requests Workflow — Cross-Application Plan (2026-08-28)

**Status**: PLANNING ONLY — read-only audit and design synthesis.
**Convention**: OBSERVED = in code right now, INFERRED = best read from absence / naming, NOT PRESENT = searched and found nothing. Where a later section recommends new design, it is clearly marked PROPOSED (out-of-scope of the audit phase).

This document is the deliverable of an audit directive ("REMEDYGCC — REQUESTS WORKFLOW / CROSS-APPLICATION DISCOVERY + IMPLEMENTATION PLAN / PLANNING / AUDIT ONLY — NO CODE CHANGES"). It records (1) what Requests are in the three RemedyGCC applications today, (2) the conceptual model they imply, and (3) a planning-only design proposal for a *global* Requests system spanning `tenantapp`, `remedygcc-admin`, and `remedygcc-marketing`. Nothing was modified.

---

## 0. Reading order

- §1 — Direct answer to "What is a Request in RemedyGCC today?"
- §2 — Three-app surface map (the audit findings, condensed).
- §3 — What a Request is NOT (REQUEST vs CHAT / NOTIFICATION / CLAIM / TASK).
- §4 — Conceptual model: the implied global Request primitive.
- §5 — Relationship between Request and Claim.
- §6 — Cross-application flow diagram.
- §7 — Request → Chat and Request → Notification interactions.
- §8 — Request data model (minimum useful fields).
- §9 — Request lifecycle.
- §10 — Request types / kinds.
- §11 — Authorization and data ownership.
- §12 — Super Admin Request workspace.
- §13 — Employee-facing experience.
- §14 — Navigation / information architecture.
- §15 — Hard rule on "Requests ≠ Tasks".
- §16 — Implementation phases (planning only, no code).
- §17 — Out-of-scope / non-goals.
- §18 — Audit citations.

---

## 1. Primary question — what is a Request in RemedyGCC today?

**A Request, as it actually exists in the code, is a first-class document in the `claimRequests` Mongo collection. It is a structured question that a clinic or employee asks an organization (tenant admin) about a specific claim, expecting a discrete four-way decision: `approved | rejected | more_info | converted_to_chat`.**

Three things make this primitive distinct from anything else in the system:

1. **It is a document, not a message.** The `claimRequests` collection is its own table; requests are not rows inside `claimMessages`, not embedded on `ReimbursementDocument`, and not a `ClaimMessageType` enum value.
2. **It has its own lifecycle.** Status moves from `pending` to one of four terminal states. The lifecycle is mutually exclusive — no double-decide.
3. **It can be converted into a chat thread.** The `converted_to_chat` decision is a real side effect: it seeds a chat message with body `[Request] ${subject} — ${body}` and stores `convertedToChatMessageId` on the request.

Everything else about Requests follows from those three facts.

---

## 2. Three-app surface map (condensed audit findings)

### 2.1 `tenantapp` — the source of truth

**OBSERVED.** Requests are a complete, internally-coherent feature here.

- **Collection**: `claimRequests` (`tenantapp/src/server/db/documents.ts:386–401`).
- **Schema**: `requestId`, `tenantId`, `claimId` (required FK), `claimNumber?`, `subject`, `body`, `status: ClaimRequestStatus`, `requester`, `responder?`, `resolutionNote?`, `convertedToChatMessageId?`, `createdAt`, `updatedAt`.
- **Lifecycle vocabulary** (single source of truth, `documents.ts:374`): `pending | approved | rejected | more_info | converted_to_chat`.
- **Participants** (`documents.ts:376–384`): `role: "employee" | "clinic" | "tenantAdmin"`; each carries `id`, `name`, and composite `key = "${role}:${id}"` used in access queries.
- **Service layer** (`tenantapp/src/server/services/claimRequestService.ts`):
  - `createClaimRequest` — only employees + clinics; subject ≤ 200 chars, body ≤ 2000 chars; fires `claim_request` notification to tenant admins.
  - `listClaimRequests` — claim-scoped.
  - `decideClaimRequest` — only `tenantAdmin` of same tenant; only from `pending`; `converted_to_chat` seeds a chat message.
- **Repository contract** (`contracts.ts:284–290`); Mongo impl (`claimRequestsRepository.ts`); in-memory impl (`memoryRepositoryContext.ts:1047–1079`).
- **Indexes**: `requestId` unique, `(claimId, createdAt)`, `(tenantId, claimId, status)`.
- **API routes**:
  - `GET /api/reimbursements/[id]/requests` — list per claim.
  - `POST /api/reimbursements/[id]/requests` — create.
  - `POST /api/reimbursements/[id]/requests/[requestId]/decide` — tenant admin decision.
- **Authorization**: reuses `assertClaimAccess` from `claimMessageService.ts:32–66`. Same gate as chat.
- **Notification integration**: `claim_request` is one of 11 `NotificationType` values (`documents.ts:329`). On create → notify tenant admins of claim's tenant. On decide → notify requester.
- **UI**: `components/reimbursements/ClaimRequests.tsx` (~350 lines); mounted inside `ReimbursementDetailPage.tsx:511–515` (employee-side, `canDecide={false}`) and `ClinicClaimDetail.tsx:280–284` (clinic-side, `canCreate`). No standalone `/requests` route.
- **Tests**: 11 cases in `__tests__/claim-request.test.ts` covering create / validation / isolation / list / all four decisions / no-self-decide / no-superAdmin-decide / convert-to-chat seeds chat / no double-decide.

**OBSERVED nuance**. The POST route's 403 message reads "Only employees can create requests", but `canPost` is also true for clinics (per `_helpers.ts` in messages). The message is misleading; clinics ARE allowed. (INFERRED — to verify before changing, mark as a minor bug to file separately.)

**NOT PRESENT**.
- No audit-event row for request create / decide (`auditEvents` actions: employee_unlock / employee_suspended / employee_unsuspended / employee_archived / employee_registered / password_reset / password_changed only — `documents.ts:250`).
- No "open requests" indicator on `ReimbursementDocument`.
- No read-tracking on requests (`markThreadRead` exists only for chat).
- No daily-digest or batched notification.

### 2.2 `remedygcc-admin` — the operator console

**NOT PRESENT — Requests have zero Admin surface.**

- No `/requests`, `/support`, `/tickets`, `/inquiries` route.
- No sidebar entry (`Sidebar.tsx:15–31` lists 10 items: Dashboard, Tenants, Clinics, Claims & Billing, Payments, Employees, Scanners, System Logs, Attribute Templates, Settings).
- No `requests/` directory under `src/app/api/super-admin/`.
- `ClaimChat` (`src/components/claims/ClaimChat.tsx`) is **read-only** in admin — `reimbursements/[id]/page.tsx:378–383` mounts it with `readOnly` prop; the composer is hidden. The Admin can read chat but cannot post.
- `NotificationBell` (`src/components/notifications/NotificationBell.tsx:107`) navigates every notification, regardless of type, to `/reimbursements/${claimId}`. The `claim_request` notification type exists in the union but is indistinguishable in the UI.

**INFERRED consequence.** When an employee or clinic submits a Request, a `claim_request` notification reaches the Super Admin. The bell fires; the Admin clicks through; lands on a claim detail page; sees the read-only chat; does NOT see the request itself, cannot decide it, cannot comment on it. The request is effectively invisible to Super Admin. This is the central gap a global Requests workspace must close.

**Foundation for closing it.** Admin already has:
- Direct-Mongo primitive (`runMongoScript<T>`) used by R1/R2 (this phase).
- `requireApiAuth(request)` returning `{ adminId, adminEmail, adminRole }`.
- `runMongoScript` knows how to read the shared `tenantapp` database (`mongodb://localhost:27017/tenantapp`).
- A proven 5-stage financial pipeline UI vocabulary (`FinancialStatusBadge`, `formatCurrency`, `CLAIM_STATUS_DISPLAY`) ready to extend.

### 2.3 `remedygcc-marketing` — the employee portal

**OBSERVED — one and only one request-shaped surface.**

- API proxy: `src/app/api/employee-access/claims/[id]/requests/route.ts` (GET + POST).
  - Forwards to `${TENANT_APP_URL}/api/reimbursements/${id}/requests?tenantId=...&employeeCode=...` with `x-admin-api-key`.
  - Session derived from HMAC-signed `employee_session` cookie (`lib/employee-access/session.ts`).
  - Normalizes the two error shapes (`{ error: string }` vs `{ error: { code, message, details } }`) so the UI never renders `[object Object]`.
  - 10-second `AbortSignal.timeout` on both legs.
  - POST payload: `{ subject, body }`.
- UI surface: `src/components/claims/ClaimRequests.tsx`.
- Status enum understood: `pending | approved | rejected | more_info | converted_to_chat` — identical to tenantapp.
- Mounted only inside `ClaimDetail.tsx:282–296`.

**OBSERVED consequence.** The marketing portal today is the only place where an employee can fire a Request at the organization. The Super Admin is downstream of the same primitive but cannot see what came in.

**Critical risk verified closed.** Earlier suspicion that the marketing proxy pointed at a now-dead tenantapp endpoint — false. `tenantapp/app/api/reimbursements/[id]/requests/route.ts` is live (POST lines 44–99, GET lines 18–42) and reachable from marketing.

### 2.4 Cross-app ownership table

| Surface | Today | Owner |
|---|---|---|
| Collection | `claimRequests` (Mongo, tenantapp DB) | tenantapp |
| Service / business logic | `claimRequestService.ts` | tenantapp |
| Repository contract + impls | `claimRequestsRepository.ts` (Mongo), memory impl | tenantapp |
| API routes | `tenantapp/app/api/reimbursements/[id]/requests/...` | tenantapp |
| Authorization gate | `assertClaimAccess` in `claimMessageService.ts` | tenantapp |
| Notification dispatch | `notificationService` (`claim_request` type) | tenantapp |
| Employee-side UI | `ClaimRequests.tsx` mounted in `ClaimDetail.tsx` | remedygcc-marketing |
| Employee-side API proxy | `marketing/src/app/api/employee-access/claims/[id]/requests/route.ts` | remedygcc-marketing |
| Tenant-admin UI (decider) | `ClaimRequests.tsx` mounted in `ReimbursementDetailPage.tsx` (`canDecide`) | tenantapp |
| Clinic-side UI | `ClaimRequests.tsx` mounted in `ClinicClaimDetail.tsx` | tenantapp |
| **Super-admin UI** | **NOT PRESENT** | (gap) |
| **Super-admin API** | **NOT PRESENT** | (gap) |
| Audit-event row on lifecycle | NOT PRESENT | (gap) |

---

## 3. What a Request is NOT — distinguishing the four concepts

This is the conceptual core of the plan. The audit makes the distinctions crisp; future code must preserve them.

### 3.1 Request ≠ Chat

- A Chat message lives in `claimMessages` collection, has type `message | official_update | system`, has a participant composite key, supports read-tracking via `readBy` set, supports 200-message pagination.
- A Request lives in `claimRequests`, has a 4-branch decision lifecycle, has `pending` as its starting state, has no read-tracking, has a discrete decision by a single decider.
- The two collections are siblings. They are NOT a hierarchy.
- There is exactly one bridge: the `converted_to_chat` decision seeds a chat message with body `[Request] ${subject} — ${body}` and stores `convertedToChatMessageId` on the request. The bridge is **one-way** (request → chat). There is no chat → request conversion path. A chat message does not "become" a request.
- Back-reference is asymmetric: the request knows the chat message it was converted into, but the chat message does not know it was seeded from a request.

### 3.2 Request ≠ Notification

- A Notification lives in `notifications`, has 11 `NotificationType` values, is a transient fire-and-forget event, has a `recipientType` and `recipientId`, has `read` + `readAt` fields, has no body of its own beyond `title` + `body` strings.
- A Request lives in `claimRequests`, has 5 `ClaimRequestStatus` values, is a persistent structured conversation, has `subject` + `body` + decision vocabulary.
- Notifications are *created by* requests (one on create, one on decide). Notifications are NOT a kind of request. The `claim_request` notification type is the only request-related notification.

### 3.3 Request ≠ Claim

- A Claim is `ReimbursementDocument` in the `reimbursements` collection. It has the frozen financial status machine: `pending → in_progress → approved → to_be_paid → paid` (with `rejected` / `frozen` branches). It is the unit of money.
- A Request is a side conversation *about* a claim. `decideClaimRequest` does NOT modify `ReimbursementDocument.status`. The claim's own state is independent of any request attached to it.
- **A request does NOT change claim status. A request asks whether something CAN happen; the claim record records what DID happen.** This is a critical invariant — see §5.

### 3.4 Request ≠ Task

- There is no Tasks feature in RemedyGCC. There is no Jira/Trello integration. There is no workflow engine.
- A Request is a question awaiting a discrete decision. It is not a to-do. It does not have assignees, dependencies, due dates, or progress tracking.
- The audit directive makes this explicit ("Do not confuse Requests with Tasks. No Jira/Trello inside RemedyGCC. Avoid workflow-engine complexity.") and the plan honors it.

---

## 4. Conceptual model — the implied global Request primitive

Reading the existing primitive and the gap, the implied model for a *global* Requests system is:

> **A Request is a structured question addressed to a specific decider, optionally anchored to a subject (a claim, a clinic, a tenant, an employee, an organization, or none), carrying a `subject` + `body`, having a defined lifecycle of `pending → <decision>`, and emitting exactly two notifications (created, decided).**

Three properties distinguish it from anything else:

1. **It is a first-class document.** Not a chat message. Not a notification. Not embedded on another document.
2. **It has a discrete decision vocabulary.** Four today; the global system may extend with `withdrawn`, `expired`, `delegated` — see §9.
3. **It can produce side-effects on a paired thread** (today: chat). The side-effect is one-way and irreversible.

The current `claimRequests` primitive is a *specialization* of this model where `subjectType = "claim"`, `requester ∈ {employee, clinic}`, `decider = tenantAdmin`. The global system generalizes `subjectType` and the actor sets.

---

## 5. Request ↔ Claim relationship

This is the most important relationship in the design and the one most likely to be misread.

### 5.1 Three valid relationships

| Relationship | Meaning | Allowed? |
|---|---|---|
| **Must** | A Request MUST belong to a claim | Today, yes (every existing primitive does). |
| **May** | A Request MAY belong to a claim | Yes — a global system should support both claim-scoped and claim-less requests (e.g. "Add me as a clinic", "Reset my password", "Approve a refund exception"). |
| **Never** | A Request MUST NOT modify the claim status | **Always true.** Requests are conversations, not state changes. |

### 5.2 Why the claim FK is the hardest decoupling burden

In the current model, every request is `claimId`-anchored. Every API route is `/api/reimbursements/[id]/requests/...`. Every list endpoint takes a `claimId`. There is no "show me all requests for this tenant" route. A global system needs either:

- (a) Make `claimId` optional on `ClaimRequestDocument`, add a typed `subjectType: "claim" | "clinic" | "tenant" | "employee" | "organization" | "none"` discriminator, and introduce `subjectRef: { type, id }`. **Breaking change.**
- (b) Add a parallel `globalRequests` collection with its own identity, leaving `claimRequests` untouched. **Additive — preferable.** Keeps the working feature intact; introduces the global model in a sibling collection; eventually unifies if needed.

**Recommendation**: option (b) for the planning-only design. Do not change `claimRequests` until the global feature has shipped, been measured, and a unification path is justified.

### 5.3 Coupling invariant

**Whatever changes, this must hold**: deciding a Request never mutates `ReimbursementDocument.status`. The financial state machine is frozen (Phase 6 verification 2026-08-26, in the auto-memory). Requests ask questions; humans then act on the claim in the financial workspace (approve claim, queue payment, mark paid). Those are two separate actions on two separate documents.

---

## 6. Cross-application flow diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EMPLOYEE (marketing site, signed in via employee_session cookie)            │
│   ClaimDetail.tsx → ClaimRequests.tsx                                       │
│     POST /api/employee-access/claims/[id]/requests  {subject, body}          │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │  (proxy, x-admin-api-key)
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TENANTAPP                                                                   │
│   POST /api/reimbursements/[id]/requests                                     │
│     → claimRequestService.createClaimRequest                                 │
│       • assertClaimAccess (employee)                                         │
│       • insert into claimRequests {status: "pending"}                       │
│       • notificationService.notifyTenantAdmins({type: "claim_request"})     │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ MongoDB tenantapp.claimRequests                                       │ │
│   │ MongoDB tenantapp.notifications                                       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
└─────┬──────────────────────────────────────────────────┬───────────────────┘
      │                                                  │
      │ notifications                                    │ requests
      ▼                                                  ▼
┌──────────────────────────┐                ┌──────────────────────────────┐
│ EMPLOYEE bell            │                │ TENANT ADMIN dashboard       │
│ (sees own reply later)   │                │ ReimbursementDetailPage      │
└──────────────────────────┘                │   ClaimRequests canDecide=    │
                                            │   true → POST /decide         │
                                            └──────────────────────────────┘
      │                                                  │
      │                                                  │ on converted_to_chat:
      │                                                  │   postChatMessage("[Request]...")
      │                                                  ▼
      │                                       ┌──────────────────────────────┐
      │                                       │ claimMessages (sibling coll) │
      │                                       └──────────────────────────────┘
      │                                                  │
      │                                                  ▼
      │                                       ┌──────────────────────────────┐
      │                                       │ ADMIN chat (read-only) sees  │
      │                                       │ the seeded message           │
      │                                       └──────────────────────────────┘
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SUPER ADMIN (remedygcc-admin) — TODAY: blind to requests                     │
│   NotificationBell sees claim_request, clicks → /reimbursements/[id]         │
│   ClaimChat is readOnly. No /requests route. No decide surface.              │
│                                                                             │
│   ─── PROPOSED (PLANNING ONLY) ────────────────────────────────────────────  │
│   NotificationBell click → /requests/[requestId]  (NOT /reimbursements)     │
│   Sidebar gets a "Requests" entry                                            │
│   /requests list, /requests/[id] detail, /requests/[id]/decide               │
│   Authorization: superAdmin (read + decide)                                  │
│   UI: same 5-status vocabulary as tenantadmin, plus filters                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Request → Chat and Request → Notification interactions

### 7.1 Request → Chat (one-way, today)

- `converted_to_chat` decision calls `postChatMessage` with body `[Request] ${subject} — ${body}`.
- Stores `convertedToChatMessageId` on the request.
- Back-reference is **asymmetric**. There is no `requestId` field on `ClaimMessageDocument`.
- **INFERRED risk**: if the chat message is later edited or deleted, the request points at a stale messageId. No referential integrity enforcement. A global system should either store the bridge immutably or add a back-reference.
- **Direction**: never chat → request. There is no API to convert a chat message into a request.

### 7.2 Request → Notification (two notifications per lifecycle)

- On `create`: `notificationService.notifyTenantAdmins({ type: "claim_request", claimId, title: "New request from ...", body: subject })`.
- On `decide`: notification fires to requester (and clinic if clinic-initiated) with title `Request ${decisionLabel(decision)}` where `decisionLabel` maps `approved → Approved`, `rejected → Rejected`, `more_info → Needs more info`, `converted_to_chat → Moved to chat` (INFERRED — exact strings to verify in service code).
- There is no third notification (no edit, no comment, no reminder).
- There is no batched / digest / daily-summary notification today.
- **Generalization path for global system**: add a new notification type `global_request` (additive, non-breaking) alongside the existing `claim_request`. Do not generalize `claim_request` itself — keep it claim-scoped for backward compatibility.

---

## 8. Request data model — minimum useful fields

The plan proposes (PROPOSED, not implemented) the following minimum useful fields for a `globalRequests` collection. `claimRequests` is left untouched.

| Field | Type | Purpose |
|---|---|---|
| `requestId` | string | Primary key (UUID) |
| `tenantId` | string | Tenant scope (for tenancy isolation, mirrors `claimRequests`) |
| `subjectType` | enum: `claim \| clinic \| tenant \| employee \| organization \| none` | What is the request about? |
| `subjectRef` | `{ type, id } \| null` | Reference to the subject document. `null` when `subjectType === "none"`. |
| `subject` | string (≤ 200 chars) | Short title |
| `body` | string (≤ 2000 chars) | Full text of the question |
| `status` | `ClaimRequestStatus` (today's enum) | `pending \| approved \| rejected \| more_info \| converted_to_chat` |
| `requester` | `ClaimRequestParticipant` | Who asked (role/id/name/key) |
| `responder` | `ClaimRequestParticipant?` | Who decided |
| `resolutionNote` | string? | Optional response text |
| `convertedToThreadMessageId` | string? | For `converted_to_chat`, the seeded message id |
| `createdAt`, `updatedAt` | ISO string | TimestampFields |

**Indexes proposed** (mirror today's `claimRequests` shape, generalized):
- `requestId` unique
- `(subjectType, subjectRef.id, createdAt desc)`
- `(tenantId, status, createdAt desc)`
- `(requester.key, createdAt desc)` — for "my requests" inbox

**Authorization field** (NOT a stored field — derived): the decider is determined by `subjectType` + `subjectRef`. For `claim`, the decider is the claim's tenant admin. For `tenant`, it could be a Super Admin. The derivation rule lives in service code, not on the document.

---

## 9. Request lifecycle

Today: `pending → {approved | rejected | more_info | converted_to_chat}`. Terminal states are mutually exclusive; no double-decide.

The global system should preserve this discipline and consider (PLANNING ONLY) optional extensions:

| Status | Meaning | Today's source | Proposed extension |
|---|---|---|---|
| `pending` | Awaiting a decision | Yes | Keep |
| `approved` | Decider said yes | Yes | Keep |
| `rejected` | Decider said no | Yes | Keep |
| `more_info` | Decider needs more from requester | Yes | Keep — requester can re-engage with new body in a follow-up message (NOT a new request) |
| `converted_to_chat` | Moved to a chat thread | Yes | Keep — already a chat message; thread is the conversation now |
| `withdrawn` | Requester retracted | No | Proposed (PROPOSED) — requester cancels their own pending request |
| `expired` | Timed out without decision | No | Optional — only if a business SLA is defined |
| `delegated` | Decider routed to someone else | No | Optional — only if multi-decider workflows are introduced |

**Hard rule (PROPOSED)**: no transitions between terminal states. `approved` is final. `withdrawn` is final. `expired` is final. `converted_to_chat` does NOT prevent the chat thread from continuing; it just closes the request side. (This mirrors the audit finding: chat is a sibling, not a child.)

---

## 10. Request types / kinds

For the global system, request "types" are two-dimensional:

1. **Subject type** (what it's about): `claim | clinic | tenant | employee | organization | none`.
2. **Decider class** (who can resolve it): `tenantAdmin | superAdmin | clinic | self`.

The matrix is enforced by authorization rules (§11), not by stored fields.

Today's primitive occupies one cell: `subjectType=claim`, `deciderClass=tenantAdmin`. The global system opens the other cells. Examples of each cell:

| Cell | Example | Plausible? |
|---|---|---|
| claim × tenantAdmin | "Can I bill this assessment at 1000 OMR?" (today's only case) | Yes — keep |
| claim × superAdmin | "Approve an out-of-policy exception on claim #2048" | Yes — global addition |
| clinic × superAdmin | "Approve onboarding of Clinic XYZ" | Yes — global addition |
| tenant × superAdmin | "Approve adding a new admin to Tenant ABC" | Yes — global addition |
| employee × superAdmin | "Lift my suspended status" | Yes — global addition |
| organization × superAdmin | "Approve a refund exception on behalf of an org" | Yes — global addition |
| none × superAdmin | "Free-form question to RemedyGCC ops" | Yes — global addition |
| clinic × clinic | (cross-clinic coordination — unusual) | Defer |
| employee × self | (self-withdrawal — handled by `withdrawn` status) | Defer to status, not type |

---

## 11. Authorization and data ownership

### 11.1 The 4 auth silos (today)

The audit confirms these 4 silos, established by `tenantapp/app/api/reimbursements/[id]/messages/_helpers.ts` and shared with the requests path:

1. `x-admin-api-key` + `tenantId` + `employeeCode` → employee (via marketing proxy)
2. `x-admin-api-key` alone → super admin
3. Clinic session → clinic user
4. Tenant dashboard session → tenant admin

**These silos are the right granularity for any global system.** The plan keeps them. The global system adds Super Admin as a *first-class* actor with its own surfaces, not as a side-effect of having `x-admin-api-key`.

### 11.2 Authorization matrix (PROPOSED for the global system)

| Action | employee | clinic | tenantAdmin | superAdmin |
|---|---|---|---|---|
| Create a Request | Yes (own scope) | Yes (own scope) | Yes (own tenant) | Yes (any scope) |
| List requests for a subject | Yes (own scope) | Yes (own scope) | Yes (own tenant) | Yes (any scope) |
| Read a single request | Yes (if requester or in audience) | Yes (if requester or in audience) | Yes (own tenant) | Yes (any scope) |
| Decide a request | No | No | Yes (own tenant, by subject) | Yes (by subject) |
| Comment on a request | No (use `more_info` decision) | No | Yes (own tenant) | Yes |
| Withdraw a request | Yes (own, pending only) | Yes (own, pending only) | n/a | n/a |

### 11.3 Tenancy and data ownership

- `tenantId` is the tenancy carrier for both `claimRequests` and the proposed `globalRequests`.
- Super Admin is platform-wide; not bound to `tenantId`. The `assertClaimAccess` rule already accommodates this: `superAdmin` → cross-tenant allowed.
- The Admin's existing chat viewer key `superAdmin:super-admin` is the canonical Super Admin identity for the global requests workspace too. Do NOT introduce per-admin identity unless explicitly required.
- **Audit trail gap (carry forward into implementation)**: requests today do not write to `auditEvents`. The global system must emit audit events from day one: `request_created`, `request_decided`, `request_withdrawn`.

---

## 12. Super Admin Request workspace

The headline gap. Today, the Admin cannot see, list, decide, or comment on any request.

### 12.1 What the workspace must do (PROPOSED)

- List all requests platform-wide, with filters: status, subjectType, tenant, requester role, date range, free-text on subject/body.
- Show one request in detail: subject, body, requester, responder if decided, resolution note, full timeline (created → decided), linked subject (e.g. claim detail page if `subjectType === "claim"`).
- Decide a request with the same 4-way vocabulary as tenant admin (or extended if §9 additions are accepted).
- Comment on a request in non-terminal states (a comment creates an `official_update`-style chat thread entry on the linked subject, IF the subject supports it; otherwise stored as `resolutionNote`-style history).
- Notification routing: `claim_request` notifications that target superAdmin must deep-link to `/requests/[requestId]`, not to `/reimbursements/[id]`.
- Polling cadence: 30 seconds, matching `ClaimChat` and `NotificationBell` (per `super-admin-audit-2026-08-20.md` lines 37–39). No real-time push.

### 12.2 API surface (PROPOSED)

Under `/api/super-admin/requests/...`:

- `GET /api/super-admin/requests` — list with filters (`?status=&subjectType=&tenantId=&requesterRole=&limit=&cursor=`).
- `GET /api/super-admin/requests/[requestId]` — single detail.
- `POST /api/super-admin/requests/[requestId]/decide` — `{ decision, resolutionNote? }`.
- `POST /api/super-admin/requests/[requestId]/comment` — `{ body }`.

Three architectural options (PLANNING ONLY — none chosen):

- **Option A — Proxy to tenantapp.** Mirror the messaging pattern. Add `x-admin-api-key` superAdmin paths in tenantapp, or extend the existing `decide` route to accept `superAdmin` actor. **Pro**: minimum new code. **Con**: couples Admin to tenantapp's auth model and service.
- **Option B — Direct Mongo via `runMongoScript`.** Reuse the Phase C primitive (this phase's hard-won infrastructure). **Pro**: Admin is independent of tenantapp's auth model. **Con**: bypasses service-layer invariants (authorization, audit, notifications).
- **Option C — Hybrid.** Reads via `runMongoScript` (read-only direct Mongo), writes via tenantapp proxy (to preserve service-layer guarantees). **Pro**: best of both — reads are fast and decoupled, writes stay governed. **Con**: two code paths to maintain.

**Recommendation**: option C. It matches the pattern established in Phase C for `unread-count` and `claim-messages` (reads via direct Mongo, writes preserved through tenantapp) and respects the audit-trail requirement.

### 12.3 UI vocabulary (PROPOSED)

Reuse what already exists, do not invent:

- `FinancialStatusBadge` for status pills — extended with the 5 request statuses (or 7 if extensions are accepted).
- `formatCurrency` if amounts are surfaced (today: requests carry no money; do not invent any).
- `CLAIM_STATUS_DISPLAY` / `CLAIM_STATUS_TONE` for linked-claim status (where `subjectType === "claim"`).
- No new icon library. Use `lucide-react` only. Icons that carry meaning (e.g. `MessageSquare`, `CheckCircle2`, `XCircle`, `HelpCircle`, `MessagesSquare` for `converted_to_chat`).
- Visual system: extend Phase 7 dashboard design rules (neutral foundation, one accent, semantic tones only, no gradients).

### 12.4 Dashboard integration (PROPOSED)

The Phase 9 dashboard redesign plan includes `Notifications unread (Super Admin)` as a metric. A requests workspace should add at minimum:

- A `Pending requests` count to the `AttentionCenter` if > 0.
- A "Requests" feed in `RecentFinancialActivity` is NOT appropriate (requests aren't financial). Instead, a dedicated `RecentRequests` panel, or surface requests inside the existing `OperationalContext` only if the count is non-trivial.
- Deep-link from `NotificationBell` for `claim_request` notifications to the requests detail page, not to the claim detail page.

---

## 13. Employee-facing experience

Today's employee-facing experience is already complete:

- Employee signs in via HMAC-signed `employee_session` cookie on the marketing site.
- Visits a claim detail page.
- Sees `ClaimRequests` mounted below the chat.
- Submits `{ subject, body }`. The request fires off, the employee sees their pending request, and gets a notification on the tenant admin's decision.

**What the global system should NOT change**:
- The marketing-site proxy stays a proxy. No new business logic in marketing.
- The employee UX stays inside the claim detail page. A global `/requests` page for employees is unnecessary — employees have at most a handful of claims and see requests inline already.

**What the global system CAN add (PROPOSED, optional)**:
- A small "My open requests" badge in the employee's claim list (`/reimbursement/employee/claims`).
- A "Request status" filter on the claim list (e.g. "claims with pending request").
- Nothing else. The marketing site is a thin proxy and must stay that way.

---

## 14. Navigation / information architecture

### 14.1 Super Admin sidebar (PROPOSED addition)

Add **one** entry:

```
... existing items ...
Requests                /requests        [Bell badge: N pending]
... existing items ...
```

Badge count = count of pending requests platform-wide for Super Admin. Reuses the existing `NotificationBell` polling cadence.

### 14.2 `/requests` page (PROPOSED)

Top-level workspace, parity with `/tenants`, `/clinics`, `/reimbursements`, `/payments`. Two regions:

- **Filters bar**: status (multi), subjectType (multi), tenant (dropdown), requester role (multi), date range, free-text.
- **Table**: request ID (truncated), subject (linked), requester, subject type, tenant, status, decided-at, age.

Empty state: "No requests match your filters." Not "No data".

### 14.3 `/requests/[id]` page (PROPOSED)

Three regions:

- **Header**: subject + status badge + decider avatar (if decided) + age.
- **Subject**: claim/clinic/tenant/employee link (if `subjectType !== "none"`).
- **Body**: original request body, then resolution note if decided.
- **Timeline**: created → decided (if decided). No third-party events.
- **Action bar**: if pending, the four decision buttons + optional resolution note textarea. If decided, the action bar shows the decision label and is disabled.

### 14.4 NotificationBell click routing change (PROPOSED)

`NotificationBell.tsx:107` currently routes every notification to `/reimbursements/${n.claimId}`. Change: if `n.type === "claim_request"`, route to `/requests/${n.requestId}` (requires `requestId` on `NotificationDocument` — see §11.3 audit trail). This is a single-line routing change with no schema migration if `claimId` continues to carry the requestId encoded in `claimId` (NOT recommended; cleanest is to add a `requestId?` field on `NotificationDocument` — additive).

### 14.5 Tenant admin sidebar — leave alone

Today's tenant admin can already decide requests inside the claim detail page (`canDecide={true}`). Adding a tenant-admin global `/requests` page is **out of scope** for this plan. The audit confirms there is no such page today; the plan does not propose adding one. The tenant admin's request surface stays embedded in the claim detail.

---

## 15. Hard rule: Requests ≠ Tasks

The audit directive makes this explicit. The plan re-states it as a guardrail:

- A Request is a **question** awaiting a **discrete decision**.
- A Request is **not** a to-do. It has no assignee field, no due date, no dependencies, no progress %, no checklist.
- A Request is **not** a workflow. There is no state machine for "in progress → review → done". The lifecycle is `pending → <one terminal>`.
- A Request does **not** trigger sub-tasks. It does not spawn child requests.
- There is **no** SLA, **no** escalation timer, **no** reminder notification.

If a future feature needs assignees / SLAs / sub-tasks, that is a **different** feature (e.g. "Workflows"). It does not belong in Requests.

---

## 16. Implementation phases (PLANNING ONLY)

The plan does not write code. The phases below describe the *order of work* when implementation begins, with explicit dependencies.

### 16.1 Phase A — Foundation (tenantapp, additive)

- Add a new Mongo collection `globalRequests` (sibling to `claimRequests`).
- Add `RequestSubjectType` enum (`claim | clinic | tenant | employee | organization | none`).
- Add `GlobalRequestDocument` interface and repository contract + Mongo impl + memory impl.
- Add `globalRequestService` with `create`, `list`, `decide`, `withdraw`. Reuses `assertClaimAccess`.
- Add notification type `global_request` alongside existing `claim_request`.
- Emit audit events on create/decide/withdraw.
- New API routes:
  - `POST /api/global-requests` (create — caller supplies `subjectType` + `subjectRef` + `subject` + `body`).
  - `GET /api/global-requests` (list, filtered by `subjectType` and viewer's scope).
  - `GET /api/global-requests/[requestId]` (detail).
  - `POST /api/global-requests/[requestId]/decide`.
  - `POST /api/global-requests/[requestId]/withdraw`.
- Tests in `__tests__/global-request.test.ts`.

### 16.2 Phase B — Super Admin read surface (remedygcc-admin, additive)

- New sidebar entry `/requests`.
- New page `/requests` (list) and `/requests/[id]` (detail).
- New API routes (proxy-to-tenantapp OR direct-Mongo per §12.2 option C):
  - `GET /api/super-admin/requests` (list).
  - `GET /api/super-admin/requests/[id]` (detail).
- Components: `RequestListRow`, `RequestFilters`, `RequestDetailHeader`, `RequestDetailBody`, `RequestTimeline`.
- No new collections in admin DB. No new connection.

### 16.3 Phase C — Super Admin decide + comment (remedygcc-admin, additive)

- New API routes:
  - `POST /api/super-admin/requests/[id]/decide`.
  - `POST /api/super-admin/requests/[id]/comment`.
- Decision UI on `/requests/[id]` (4 buttons + optional resolution note).
- Comment UI on `/requests/[id]` (textarea + submit).
- Polling cadence 30s, matching existing chat/bell.

### 16.4 Phase D — NotificationBell re-routing

- Add `requestId?: string` to `NotificationDocument` (additive).
- Modify `NotificationBell.tsx:107` to route `claim_request` → `/requests/${n.requestId}`, leave all other types on existing paths.
- Verify deep-link from marketing-side `claim_request` notifications.

### 16.5 Phase E — Dashboard integration

- Add `Pending requests` count to `AttentionCenter` of Phase 9 dashboard.
- Add a `RecentRequests` panel to `OperationalContext` (or a dedicated region if preferred; defer to dashboard redesign pass).

### 16.6 Phase F — Marketing/employee enhancements (optional)

- "My open requests" badge in employee claim list.
- "Claims with pending request" filter.
- No new API surface in marketing — read via existing proxied endpoints.

### 16.7 Phase G — Documentation + tests

- `docs/implementation/requests-system-2026-XX.md` (this plan, updated to "shipped").
- Tests: at least one e2e path per actor (employee create → tenant admin decide → super admin sees; super admin create → super admin decide; clinic create → tenant admin decide).
- Type checks, lint, manual smoke on dev.

### 16.8 Phase ordering rules

- Phase A must land first. It owns the data model.
- Phase B can land in parallel with Phase A's API route stabilization.
- Phase C depends on Phase B.
- Phase D is independent and can land any time after Phase A.
- Phase E depends on Phase C.
- Phase F is optional and lowest priority.
- Phase G ships with each phase, not at the end.

---

## 17. Out-of-scope / non-goals

- ❌ Modifying the existing `claimRequests` collection or its API routes (Phase 0). The audit found them working; the global system is additive.
- ❌ Implementing Tasks / Workflows / Assignees / SLAs / Escalations.
- ❌ A tenant-admin global `/requests` page (tenant admin keeps the embedded-in-claim surface).
- ❌ Removing or replacing `claim_request` notification type.
- ❌ Making `ClaimMessageType` include a `request` enum value.
- ❌ Embedding requests inside `ReimbursementDocument`.
- ❌ Caching of any kind for requests.
- ❌ WebSocket / SSE push notifications.
- ❌ Real-time multi-user collaboration on a request.
- ❌ Per-admin identity (today's hardcoded `superAdmin:super-admin` viewer key carries over).

---

## 18. Audit citations

Full audit reports produced during this planning phase:

- `docs/audits/tenantapp-requests-current-state-2026-08-27.md` — 10-section current-state audit of tenantapp's request primitive. Authoritative source for §2.1.
- Inline marketing-site findings (no persisted doc; agent `ab1e02e4642a977bb`) — one and only one request-shaped surface in marketing repo, live and working. Authoritative source for §2.3.
- Inline super-admin findings (no persisted doc; agent `aa7237967a141351d`) — zero request surface in admin app. Authoritative source for §2.2.
- Pre-existing: `RemedyGCC/COMMUNICATION_FEATURES_AUDIT.md` §7.4 and §10 (lines 391–402) — historical context for build → remove → re-implement 2026-08-03.
- Pre-existing: `remedygcc-admin/docs/audits/super-admin-audit-2026-08-20.md` lines 37–39 — 30s polling cadence for `ClaimChat` and `NotificationBell`.
- Pre-existing: `remedygcc-admin/docs/implementation/claims-billing-ux-rebuild-2026-08-27.md` line 232 — "Chat, notifications, requests modules" listed as planned future work.

---

## 19. HARD STOP

This document is the planning-only deliverable for the audit directive "REMEDYGCC — REQUESTS WORKFLOW / CROSS-APPLICATION DISCOVERY + IMPLEMENTATION PLAN / PLANNING / AUDIT ONLY — NO CODE CHANGES".

No code, no migrations, no collections, no API routes, no UI components, no refactors were written during this phase. The implementation phases in §16 are descriptions of *future* work; they are not commitments and they do not begin until the directive explicitly authorizes them.

End of plan.