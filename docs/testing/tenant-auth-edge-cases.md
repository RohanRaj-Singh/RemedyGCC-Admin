# Tenant Authentication Edge Cases

## Archived Tenant

- login is blocked even if credentials still exist
- any previously stored tenant sessions are invalidated once access is rechecked
- super admin can still inspect dashboard credential status from the tenant detail page

## Disabled Tenant

- login is blocked
- existing tenant sessions are invalidated when tenant lifecycle changes away from `active`
- reactivation requires the tenant lifecycle to move back to an allowed state

## Draft Tenant

- credentials can be provisioned ahead of launch
- login is blocked until the tenant becomes `active`

## Disabled Dashboard Account

- login is blocked even when the tenant lifecycle is `active`
- reset and reactivation remain super admin operations

## Stale or Expired Sessions

- expired sessions are rejected during validation
- rejected sessions are deleted from persistence
- Mongo TTL cleanup provides additional stale-session removal

## Invalid Cookies

- malformed tenant cookies are rejected by middleware before the request reaches protected pages
- tenant cookies are cleared without affecting super admin cookies

## Brute Force Attempts

- repeated failed logins against the same identifier/IP pair trigger rate limiting
- the login endpoint returns a temporary lockout response

## Forced Password Changes

- temporary reset passwords still allow login
- protected portal traffic is redirected to `/dashboard/change-password`
- dashboard access resumes only after a successful password update
