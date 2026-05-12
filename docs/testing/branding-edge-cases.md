# Branding Edge Cases

This document describes edge cases specifically related to the Tenant Branding configuration and resolution.

## Invalid Hex Values

If a user provides an invalid hex value (e.g., `#FFFZ`, missing the `#`, or rgb format) directly via API (bypassing the UI), the `normalizeHexColor()` function will detect the invalid format and safely revert to the predefined fallback (e.g., `DEFAULT_PRIMARY`).

## Missing Logos

When a tenant uploads no logo or clears an existing one, `branding.logoUrl` is stripped from the configuration. The runtime is instructed to use `DEFAULT_LOGO`. If the `DEFAULT_LOGO` asset goes missing from the public folder, an `onError` handler on the image tag must replace it with a text-based "T" initial block using the `primaryColor`.

## Broken Gradients

If a user specifies a syntactically invalid CSS gradient (e.g., `linear-gradient(135, #f00, #f00)` without `deg`), the browser will fail to parse it. The branding preview UI will visually appear flat or blank. As a guardrail, the system checks for standard completeness and issues a warning if core gradients like `brandGradient` or `heroGradient` are entirely empty.

## Duplicate Chart Colors

In cases where `chartColors` accidentally contains duplicates (e.g., `['#ff0000', '#ff0000', '#00ff00']`), the validation function (`hasDuplicateColors`) will trigger an error block. This guarantees that multi-series charts in the dashboard do not render indistinguishable adjacent regions.

## Unreadable Themes

If `primaryColor` and `secondaryColor` are both very light (e.g., `#F0F0F0` and `#FFFFFF`), standard `onPrimary` text (`#ffffff`) would become illegible. The validation process surfaces a low-contrast warning. At runtime, the `ensureAccessibleColor()` and `getReadableTextColor()` utilities will intervene to flip the text color or adjust the accent bounds to ensure accessibility.

## Missing Favicon

A missing favicon acts exactly like a missing logo. It will fall back to `DEFAULT_FAVICON` to ensure the tenant's browser tab does not look unbranded or broken.

## Oversized Branding Assets

Users may attempt to upload a massive logo (e.g., 5MB image). The ImageUploader in the admin panel restricts file size. However, if bypassed, the runtime interface employs `object-contain` and strict bounding boxes (e.g., `max-h-12 w-full`) in the UI components so layout shifting does not occur.
