# Constraints

- One scanner per tenant
- No direct DB access from frontend
- Tenant branding must fall back safely to `DEFAULT_BRANDING`
- Branding edits must not cause unrelated tenant form sections to reset or refetch
- Preview rendering must degrade gracefully for invalid image paths
- Keep branding customization simple enough for non-technical admin users
