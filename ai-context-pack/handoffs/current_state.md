# Current State

## Product State
The Super Admin app is already scaffolded and actively used. Core areas exist for:
- Dashboard
- Tenants
- Scanners
- Logs

The app is built with Next.js App Router and Tailwind CSS. Data access in the current workspace is still mock/service-driven in the frontend layer, with Laravel API integration planned later.

## Tenant Management State
Tenant CRUD screens exist, including:
- `src/app/tenants/page.tsx`
- `src/app/tenants/new/page.tsx`
- `src/app/tenants/[id]/edit/page.tsx`

Important tenant capabilities currently implemented:
- Create and edit tenant name, subdomain, and status
- Assign one scanner per tenant
- Store per-tenant branding instead of legacy plan-based theming

## Branding State
Branding is modeled through `BrandingConfig` and `ColorScheme` in:
- `src/types/branding.ts`
- `src/modules/tenant/types.ts`

Current branding controls exposed in the tenant flows:
- Logo image
- Primary action color
- Secondary surface color
- Highlight color
- Page background color
- Text color

## Edit Tenant Page UX State
The tenant edit page was recently reworked.

Current layout:
- Left column: tenant form + branding configuration form
- Right column: dedicated `Tenant Preview` card

Current behavior:
- Branding updates are handled separately from the tenant form state
- The scanner area no longer reloads when branding values change
- Branding preview updates live from the branding state
- Invalid or missing preview images fall back to a clean placeholder
- The preview is rendered via a dedicated preview component instead of being embedded inside the form flow

Key files involved:
- `src/app/tenants/[id]/edit/page.tsx`
- `src/components/tenants/BrandingPanel.tsx`
- `src/components/tenants/ColorPicker.tsx`
- `src/components/tenants/ImageUploader.tsx`
- `src/modules/tenant/components/TenantForm.tsx`

## Notes For Future Agents
- The right-side preview is intentionally separated from the branding controls.
- `BrandingPanel` now supports `showPreviewSection={false}` so controls can be reused without duplicate preview rendering.
- `BrandingPreviewCard` is exported from `src/components/tenants/index.ts` and is intended for split-layout pages.
