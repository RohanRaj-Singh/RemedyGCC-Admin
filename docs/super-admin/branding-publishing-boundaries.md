# Branding Publishing Boundaries

This document defines the constraints and lifecycle of branding configuration from Super Admin design time through to runtime execution.

## Branding Ownership

- **Tenant Draft:** Each Tenant record owns a `branding` object representing their desired intent. This is fluid and changeable at any moment by Super Admins.
- **Runtime Configuration:** The `TenantRuntimeConfig` collection takes complete ownership of branding once published. Runtime configs are isolated boundaries.

## RuntimeConfig Integration

When a new snapshot is created:
1. The `branding` object is copied from the Tenant document into the `TenantRuntimeConfig`.
2. Any fields that are invalid or empty are still copied as-is; the runtime application is fully responsible for substituting defaults (`DEFAULT_PRIMARY`, `DEFAULT_LOGO`, etc.).
3. The schema does not support partial or diff-based updates for branding. It is an all-or-nothing overwrite per configuration version.

## Dashboard Theme Expectations

The dashboard relies on the same strict branding properties defined within `TenantRuntimeConfig`.

Specifically:
- **`chartColors`:** Used sequentially by chart providers to render datasets. If unsupplied, the dashboard uses a pre-calculated global palette.
- **Card Reading Hierarchy:** Backgrounds of metric cards may use `gradient.cardGradient`. Text rendering over these cards is strictly tied to `getReadableTextColor(primaryColor)` or hardcoded text tokens to prevent contrast failures on lightly colored gradients.
- **Dashboard Consistency:** The dashboard makes no direct queries back to the draft `branding` collections. It is fully disconnected from the Tenant editor to guarantee no mid-flight styling mutations while users are analyzing data.
