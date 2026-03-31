# Super Admin Context

> Quick reference - For complete rules, see [rules.md](./rules.md)

## Purpose
Super Admin Control Plane for RemedyGCC multi-tenant SaaS health intelligence

## Domain
- admin.remedygcc.com

## Tech Stack
- Frontend: Next.js 14, Tailwind CSS
- Backend: Laravel API (to implement)
- Database: MongoDB

## Modules
1. **Dashboard** - Stats, charts, activity
2. **Tenants** - CRUD for tenant organizations with per-tenant branding
3. **Scanners** - Survey scanner management
4. **Logs** - System activity monitoring

## Current UI State
- The Super Admin UI is already present in this repo and is not a greenfield scaffold
- Tenant create and edit pages exist under `src/app/tenants/`
- Tenant branding is edited directly in the admin UI and previewed live
- The tenant edit screen currently uses a split layout:
  - left column for tenant form + branding form
  - right column for dedicated live preview

## Key Constraints
- One scanner per tenant
- No direct DB access from frontend
- Always use tenant_id for scoping
- Production-grade architecture
- **Per-tenant branding replaces legacy plan system**

## Branding Model (Replaces Tenant Plan)

### Overview
Each tenant now has a `branding` configuration object instead of a plan tier. This enables full white-label customization per tenant.

### BrandingConfig Structure
```typescript
interface BrandingConfig {
  logoUrl: string;                    // Required - tenant logo
  faviconUrl?: string;               // Optional - custom favicon
  colorScheme: ColorScheme;          // Required - primary colors
  fontFamily?: string;               // Optional - custom font
  assets?: BrandingAssets;           // Optional - additional assets
  metadata?: Record<string, unknown>; // Optional - custom metadata
}

interface ColorScheme {
  primaryColor: string;      // HSL format - primary brand color
  secondaryColor?: string;    // HSL format - secondary accent
  backgroundColor?: string;   // HSL format - main background
  textColor?: string;        // HSL format - primary text
  accentColor?: string;      // HSL format - call-to-action
}

interface BrandingAssets {
  headerImageUrl?: string;
  footerImageUrl?: string;
  customCss?: string;
}
```

### Default Branding (Fallback)
```typescript
const DEFAULT_BRANDING: BrandingConfig = {
  logoUrl: '/default-logo.svg',
  colorScheme: {
    primaryColor: '156 63% 16%',    // RemedyGCC green
    secondaryColor: '0 0% 96%',
    backgroundColor: '0 0% 100%',
    textColor: '0 0% 43%',
    accentColor: '212 100% 50%',    // Blue accent
  },
  fontFamily: 'Satoshi, Inter, sans-serif',
};
```

### Branding Resolution Flow
1. Request arrives with `tenant_id` (from subdomain or JWT)
2. Load tenant record with branding config
3. If `branding` is null/undefined, apply `DEFAULT_BRANDING`
4. Merge with any feature flags or tenant overrides
5. Inject into CSS variables and theme context
6. Cache result per tenant (TTL: 5 minutes)

### Storage
- Branding stored as embedded document on Tenant collection
- Alternative: Separate `brandings` collection with tenant_id reference
- No cross-tenant read access in queries

## Key Files
- `src/types/index.ts` - TypeScript types including BrandingConfig
- `src/data/mockData.ts` - Dummy data with sample branding
- `src/modules/tenant/types.ts` - Tenant and Branding types
- `src/app/tenants/[id]/edit/page.tsx` - Split tenant edit workspace
- `src/components/tenants/BrandingPanel.tsx` - Branding controls + exported preview card
- `ai-context/modules/super-admin/rules.md` - Complete rules

## Tenant Edit UX Notes
- `TenantForm` and branding state are intentionally separated to avoid scanner-list refreshes when branding changes
- `BrandingPanel` supports a controls-only mode via `showPreviewSection={false}`
- `BrandingPreviewCard` is used as the dedicated right-side preview on the edit page
- Branding preview supports logo fallback when a path is invalid or unavailable

## Getting Started
```bash
npm install
npm run dev
```

## Migration Notes
- Existing `plan` field deprecated (graceful fallback to default branding)
- Migration script will set `branding` field for all tenants
- Rollback: Revert to plan-based theming if branding fails
