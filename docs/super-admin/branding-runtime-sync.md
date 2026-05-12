# Branding Runtime Sync

This document clarifies the relationship and synchronization expectations between the Super Admin Branding configuration and the runtime tenant application.

## Runtime Branding Expectations

The runtime application expects a minimal, validated branding payload inside `TenantRuntimeConfig` called `TenantBrandingConfig`:

```ts
interface TenantBrandingConfig {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  gradient?: Record<string, string>;
  chartColors?: string[];
  themeMode?: "light" | "dark";
}
```

The runtime does **not** rely on Super Admin to pre-calculate all theme permutations (such as hover states, active states, borders, and complex gradients). It only requires the base tokens (e.g., `primaryColor`, `gradient.brandGradient`, `chartColors`).

## Fallback Behavior

Any missing fields are gracefully handled by `themeUtils.ts` in the runtime layer:
- Missing colors fall back to the `DEFAULT_PRIMARY` / `DEFAULT_SECONDARY`.
- Missing assets fall back to `DEFAULT_LOGO` and `DEFAULT_FAVICON`.
- Missing theme mode uses `light`.
- If `secondaryColor` is not provided, the runtime derives it from `primaryColor` securely without causing contrast failures.

Super Admin provides a "Live Preview" that implements the same logic to accurately portray the ultimate runtime appearance.

## Theme Boundaries

- **Super Admin Responsibility:** Store raw user intent (Hex codes, custom URLs, exact app name). Validate hex formats and asset protocols to prevent malicious injections or malformed outputs.
- **Runtime Responsibility:** Map intents to actual UI tokens (CSS Variables, exact contrast thresholds, background image URLs). Perform accessibility normalization (`ensureAccessibleColor`).

## Immutable Snapshot Behavior

When a Super Admin hits "Publish", the draft `branding` is copied exactly as-is into a frozen `TenantRuntimeConfig`. Once published, the branding configuration is completely immutable. Updates to the tenant's draft branding will not affect the active runtime until a brand-new publish is executed and promoted.
