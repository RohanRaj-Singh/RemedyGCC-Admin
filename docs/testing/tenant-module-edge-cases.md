# Tenant Module Edge Cases

## Duplicate Subdomains

- Normalize the submitted subdomain before comparing.
- Reject the save when another tenant already uses the normalized subdomain.
- Keep reserved values blocked even if the user changes case or spacing first.

## Deleting An Active Tenant

- Reject deletion when the tenant is `active`.
- Reject deletion when any published configuration exists, even if the current status is no longer active.
- Require the tenant slug as explicit confirmation before any safe draft-only delete.

## Updating Active Runtime Links

- Do not let the generic tenant update flow mutate `activeRuntimeConfigId`.
- Use the explicit activation endpoint only.
- Reject activation when the selected published configuration belongs to another tenant.

## Missing Branding

- Allow partial or empty branding drafts only when runtime fallback behavior remains safe.
- Surface fallback warnings for missing app name, logo, primary color, secondary color, or favicon.
- Reject invalid hex colors or unsupported asset URL schemes.

## Missing Runtime Configuration

- Draft tenants may exist without any published configuration.
- Active tenants must never resolve without `activeRuntimeConfigId`.
- Disabled tenants may preserve the pointer while public runtime access remains blocked.

## Stale Runtime References

- Reject activation when the target runtime config no longer exists.
- Reject activation when the runtime config does not belong to the tenant being edited.
- Keep archived tenants blocked from runtime activation or publish actions.

## Draft Setup Mismatch

- Reject publish when the selected scanner points at a different attribute template than the one currently connected on the tenant.
- Keep the active live survey unchanged until a new compatible configuration is published and activated.

## Historical Safety

- Do not allow slug or subdomain changes after runtime history exists.
- Do not allow destructive delete once submissions exist.
- Preserve prior `runtimeConfigId` records so historical submissions keep resolving correctly.
