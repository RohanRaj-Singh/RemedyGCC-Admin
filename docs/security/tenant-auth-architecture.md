# Tenant Authentication Architecture

## Scope

Tenant authentication is limited to the protected tenant dashboard surface:

- `/dashboard/*`
- `/analytics/*`
- `/reports/*`
- limited tenant settings inside the dashboard portal

It does not cover:

- public survey runtime
- super admin access
- multi-user tenant teams
- RBAC
- invite flows
- self-registration

## Business Model

Each tenant receives one primary dashboard owner account.

- creation is performed by super admin
- there is no public signup path
- there is no invitation or team membership model
- credentials are operationally managed from the tenant detail surface

## Isolation Boundaries

Tenant auth stays separate from super admin auth at every layer.

- cookie name: `tenant_dashboard_session`
- force-change cookie: `tenant_dashboard_password_change`
- user collection: `tenantDashboardUsers`
- session collection: `tenantDashboardSessions`
- tenant portal route protection is handled separately from admin route protection
- tenant auth utilities do not reuse admin session validation

Super admin auth continues to use:

- cookie name: `admin_session`
- admin user/session collections
- admin-only route guards

## Session Architecture

Tenant sessions are server-side and Mongo-backed.

- cryptographically random session tokens are generated with `crypto.randomBytes`
- sessions are persisted in `tenantDashboardSessions`
- session expiry is seven days
- each login invalidates older sessions for that tenant owner account
- expired sessions are cleaned up both proactively during auth checks and by Mongo TTL indexing

Session documents store:

- `id`
- `tenantUserId`
- `tenantId`
- `sessionToken`
- `createdAt`
- `expiresAt`
- `lastAccessedAt`
- optional `ipAddress`
- optional `userAgent`

## Credential Architecture

Tenant dashboard users are stored in `tenantDashboardUsers`.

Canonical fields:

- `id`
- `tenantId`
- `email`
- `username`
- `passwordHash`
- `status`
- `createdAt`
- `updatedAt`
- `lastLoginAt`
- `mustChangePassword`

Passwords are never stored in plaintext.

- bcrypt hashing is used with 12 salt rounds
- stored hashes are never returned to API or UI callers
- reset flows generate temporary passwords instead of exposing existing passwords

## Lifecycle Integration

Tenant dashboard access respects tenant lifecycle state.

- `draft`: credentials may exist, but login is blocked
- `active`: dashboard access is allowed if the user account is active
- `disabled`: dashboard access is blocked and tenant sessions are invalidated
- `archived`: dashboard access is blocked and tenant sessions are invalidated

When tenant lifecycle moves away from `active`, existing tenant dashboard sessions are deleted.

## Middleware Strategy

Global middleware separates admin and tenant checks.

- admin middleware continues protecting admin routes
- tenant middleware logic only protects `/dashboard`, `/analytics`, and `/reports`
- tenant login remains public at `/tenant-login`
- the public survey runtime remains unprotected

Middleware performs lightweight checks only:

- presence of the expected tenant cookie
- token format validation
- password-change redirect enforcement via isolated cookie

Database validation remains in tenant auth services and guards.

## Guard Strategy

Tenant guards support:

- protected API routes
- tenant portal layouts/pages
- analytics pages
- report pages
- settings pages

Behavior:

- invalid or expired sessions return unauthenticated responses
- disabled users lose access immediately
- non-active tenant lifecycle states invalidate access
- forced password changes redirect to `/dashboard/change-password`

## Rate Limiting

Tenant login uses a lightweight in-memory rate limiter.

- key: normalized identifier plus IP address
- max failed attempts: 5
- lockout window: 15 minutes

This protects the tenant login endpoint from basic brute-force attempts without adding extra operational complexity.

## Security Summary

The tenant dashboard auth foundation intentionally stays narrow:

- one account per tenant
- one isolated session system
- one isolated cookie namespace
- no privilege inheritance from super admin auth
- no public registration surface
