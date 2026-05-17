# Tenant Dashboard Access Flow

## Canonical Operational Flow

1. Super admin creates a tenant.
2. Super admin opens the tenant detail page.
3. Super admin creates the tenant dashboard owner credentials.
4. Tenant receives the dashboard login details.
5. Tenant signs in through `/tenant-login`.
6. Password is verified with bcrypt.
7. A server-side tenant session is created and stored in Mongo.
8. An HttpOnly tenant cookie is set.
9. Middleware and server guards protect dashboard, analytics, and reports.
10. Tenant uses the protected portal until logout or session expiry.

## Login Flow

`Tenant Login -> bcrypt verify -> create tenant session -> persist session -> set secure cookie -> redirect to protected portal`

Supported identifier input:

- email
- username

Rejected login conditions:

- invalid credentials
- disabled dashboard account
- draft tenant
- disabled tenant
- archived tenant
- rate-limited request

## Protected Surface

Tenant auth protects:

- `/dashboard`
- `/dashboard/settings`
- `/dashboard/change-password`
- `/analytics`
- `/reports`

It does not protect:

- public survey runtime routes
- super admin routes
- scanner builder routes
- publishing routes

## Super Admin Control Surface

The tenant detail page includes `Tenant Dashboard Access`.

Supported actions:

- create dashboard credentials
- reset password
- disable access
- reactivate access
- view last login
- view account status

## Session Outcomes

Successful login creates a single active tenant session for the dashboard owner.

- previous sessions are deleted
- session expiry is seven days
- inactive lifecycle states invalidate access
- logout deletes the session and clears tenant cookies
