# Tenant Edge Cases

## Duplicate Slugs

- Reject any slug that matches an existing tenant slug after normalization.
- Reject reserved values: `admin`, `api`, `www`, `dashboard`, `root`.
- Reject values that cannot remain DNS-safe within a single label.

## Invalid Branding

- Reject invalid hex colors.
- Reject unsupported asset URL schemes for logos and favicons.
- Allow partial branding only when the runtime fallback layer can safely resolve the missing fields.

## Missing Runtime Configs

- Draft tenants may exist with no `activeRuntimeConfigId`.
- Active tenants must never exist without a published `activeRuntimeConfigId`.
- Disabled tenants may retain the pointer but must not resolve publicly.

## Archived Tenant Access

- Archived tenants are historical only.
- Editing archived tenant identity, branding, status, or runtime link is blocked.
- Deletion is blocked because archived tenants may still anchor immutable runtime references.

## Broken Runtime References

- Reject activation if the target runtime config does not exist.
- Reject activation if the target runtime config belongs to another tenant.
- Reject activation if the target runtime config is not `published`.

## Partial Branding

- Missing app name falls back to `RemedyGCC`.
- Missing logo falls back to `/images/logo.png`.
- Missing secondary color is derived from the primary color and default secondary.
- Missing favicon falls back to `/favicon.ico`.
- Missing gradients are derived automatically from the resolved brand colors.

## Invalid Statuses

- Only `draft`, `active`, `disabled`, and `archived` are canonical.
- `inactive` and `suspended` are legacy states and must not re-enter the tenant module contract.
- Any unknown status must be rejected instead of coerced.

## Immutable Runtime References

- Published version refs inside an activated runtime config are read-only from the tenant module.
- Slug changes are blocked once the tenant leaves draft or links to a published runtime config.
- Non-draft tenants with runtime links cannot be deleted safely because runtime history must remain resolvable.
