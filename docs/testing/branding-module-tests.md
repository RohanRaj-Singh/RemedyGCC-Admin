# Branding Module Tests

This document outlines the testing strategy for the Super Admin Branding module to ensure that branding created in the admin app safely powers the runtime tenant app.

## Valid Branding Tests

- **Complete Branding Verification:** Ensure that a tenant with a fully populated branding config (`appName`, `logoUrl`, `faviconUrl`, `primaryColor`, `secondaryColor`, `gradient`, `chartColors`, `themeMode`) serializes correctly to the database.
- **Hex Code Validity:** Provide valid hex colors (e.g., `#FF0000`, `#F00`) to `primaryColor` and `secondaryColor` and verify no validation warnings are emitted.
- **Gradient Validity:** Check that customized gradient strings (e.g., `linear-gradient(...)`) are correctly stored and retrieved.

## Partial Branding Tests

- **Missing Secondary Color:** If `secondaryColor` is absent, the system should correctly derive a safe fallback using `mixHexColors` and emit a warning but allow saving.
- **Missing App Name:** If `appName` is empty, it should fall back to the default "RemedyGCC" and emit a runtime warning.
- **Missing Brand/Hero Gradients:** Ensure that the runtime correctly derives these gradients based on the primary and secondary colors if custom ones are not provided.
- **Missing Chart Colors:** Verify that the system falls back to the default chart colors array if not defined.

## Invalid Color Tests

- **Invalid Hex Codes:** Inputs such as `#ZZZ`, `red`, or `rgb(255,0,0)` for hex fields should trigger strict validation errors ("must be a valid hex value").
- **Contrast Check Warning:** Providing a low-contrast color against a white background (e.g., `#F8F8F8`) should trigger a contrast warning to the user.

## Logo Fallback Tests

- **Missing Logo:** Verify that when no `logoUrl` is provided, the runtime securely falls back to `DEFAULT_LOGO`.
- **Invalid Asset Reference:** Ensure that malicious or invalid logo paths (e.g., `javascript:alert(1)`) are rejected by the `isSafeAssetReference` check.

## Runtime Compatibility Tests

- **Contract Synchronization:** Verify that the JSON output from Super Admin matches exactly the `TenantBrandingConfig` schema expected by `themeUtils.ts`.
- **Preview Parity:** Ensure the "Live Preview" accurately calculates derived gradients, text readability, and fallbacks in the exact same manner as the runtime app uses.

## Dashboard Readability Tests

- **Readable Text Check:** Verify that the admin preview derives readable text color (`onPrimary`) correctly using the same luminance algorithm from the runtime.
- **No Duplicate Chart Colors:** Ensure the system correctly blocks branding setups where duplicate hex codes are provided for chart palettes, ensuring distinct bars/pie-slices in the dashboard.
