# Super Admin Context

## Purpose
Operate the RemedyGCC control plane for tenants, scanners, branding, and platform monitoring.

## Active Modules
- Dashboard
- Tenants
- Scanners
- Logs

## Current Frontend State
The Super Admin frontend is already implemented in Next.js App Router with Tailwind CSS. It is not an empty scaffold.

Important working areas include:
- Tenant listing and CRUD flows
- Scanner assignment in tenant flows
- Branding configuration for each tenant
- Shared admin sidebar layout under `src/app/tenants/layout.tsx`

## Tenant Branding Model
Tenant theming is branding-first, not plan-tier-first.

Branding currently includes:
- `logoUrl`
- `colorScheme.primaryColor`
- `colorScheme.secondaryColor`
- `colorScheme.backgroundColor`
- `colorScheme.textColor`
- `colorScheme.accentColor`
- optional font/assets metadata

## Edit Tenant Page Pattern
The current preferred editing pattern for tenant branding is:
- left workspace for edit controls
- right live preview card

Implementation notes:
- tenant details form and branding controls live in the left column
- `BrandingPreviewCard` renders separately in the right column
- `BrandingPanel` can optionally hide its internal preview with `showPreviewSection={false}`

## Key Files
- `src/app/tenants/[id]/edit/page.tsx`
- `src/app/tenants/new/page.tsx`
- `src/components/tenants/BrandingPanel.tsx`
- `src/modules/tenant/components/TenantForm.tsx`
- `src/modules/tenant/service.ts`
