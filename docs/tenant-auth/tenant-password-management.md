# Tenant Password Management

## Password Storage

Tenant dashboard passwords are stored only as bcrypt hashes.

- plaintext passwords are never stored
- existing passwords are never revealed to super admin or tenant users

## Initial Password Creation

During tenant access setup, super admin creates the initial dashboard password.

- the password is hashed before persistence
- the created credentials belong to the single tenant dashboard owner account
- tenant access may still remain blocked if the tenant lifecycle is not `active`

## Password Reset Flow

Super admin reset behavior:

1. super admin triggers reset from `Tenant Dashboard Access`
2. system generates a temporary password
3. system hashes and stores the temporary password
4. system marks `mustChangePassword = true`
5. system invalidates all existing tenant sessions
6. temporary password is shown once in the admin UI response

Reset does not allow:

- viewing the old password
- recovering the stored password
- reusing existing sessions

## Must-Change-Password Behavior

When `mustChangePassword = true`:

- login is still allowed with the temporary password
- tenant receives a valid tenant session
- middleware redirects protected portal traffic to `/dashboard/change-password`
- the tenant must provide the current temporary password and a new password
- successful change clears `mustChangePassword`
- the password-change cookie is reset so the tenant can enter the full dashboard

## Tenant Self-Service Password Change

Inside dashboard settings, the tenant owner can change the password directly.

- current password verification is required
- the new password is validated before hashing
- the updated password clears any pending `mustChangePassword` state
