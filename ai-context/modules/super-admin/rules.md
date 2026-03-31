# Kilo Rules: Super Admin Module

> **IMPORTANT**: Read this file before working on the Super Admin module

---

## 📋 Overview

**Purpose**: Super Admin Control Plane for RemedyGCC multi-tenant SaaS health intelligence

**Domain**: admin.remedygcc.com

**Tech Stack**: Next.js 14, Tailwind CSS, Laravel API (to implement)

---

## ⚠️ Constraints

1. **One scanner per tenant** - Cannot assign multiple scanners to one tenant
2. **No direct DB access** - Frontend must use API endpoints
3. **Always use tenant_id** - All data queries must include tenant_id
4. **Production-grade** - This is NOT a prototype
5. **Per-tenant branding** - Replace legacy plan system with branding configuration

---

## 📁 File Structure

```
apps/super-admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx        # Main dashboard
│   │   └── globals.css
│   ├── data/
│   │   └── mockData.ts     # Centralized dummy data
│   ├── lib/
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 📊 Data Models

### BrandingConfig (New - replaces plan)
```typescript
interface BrandingConfig {
  logoUrl: string;
  faviconUrl?: string;
  colorScheme: ColorScheme;
  fontFamily?: string;
  assets?: BrandingAssets;
  metadata?: Record<string, unknown>;
}

interface ColorScheme {
  primaryColor: string;      // hsl values
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

interface BrandingAssets {
  headerImageUrl?: string;
  footerImageUrl?: string;
  customCss?: string;
}
```

### Tenant (Updated - no plan field)
```typescript
interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  branding: BrandingConfig;           // NEW: replaces plan
  scannerId: string | null;
  totalSubmissions: number;
  createdAt: string;
  updatedAt: string;
}
```

### Default Branding (Applied when branding is null)
```typescript
const DEFAULT_BRANDING: BrandingConfig = {
  logoUrl: '/default-logo.svg',
  colorScheme: {
    primaryColor: '156 63% 16%',
    secondaryColor: '0 0% 96%',
    backgroundColor: '0 0% 100%',
    textColor: '0 0% 43%',
    accentColor: '212 100% 50%',
  },
  fontFamily: 'Satoshi, Inter, sans-serif',
};
```

### Scanner
```typescript
interface Scanner {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  questions: Question[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### SystemLog
```typescript
interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  module: 'tenant' | 'scanner' | 'submission' | 'system';
  tenantId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

---

## 🔌 Branding Resolution

### Request Flow
1. Client requests `{tenant}.remedygcc.com`
2. Middleware extracts tenant from subdomain/JWT
3. Load `Tenant.branding` from database
4. If null, apply `DEFAULT_BRANDING`
5. Generate CSS variables from config
6. Inject into theme context

### Caching Strategy
- Cache branding per tenant (Redis, TTL: 5 min)
- Invalidate on tenant branding update
- Vary cache by tenant_id only

### Security Considerations
- **Isolation**: Branding queries MUST filter by tenant_id
- **No cross-tenant leakage**: Separate collection or embedded
- **URL validation**: logoUrl/faviconUrl must be sanitized
- **CSS injection**: Prevent XSS via style injection
- **Audit logging**: Log all branding changes

---

## 🔌 API Endpoints (To Implement)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/super-admin/dashboard | Dashboard stats |
| GET | /api/super-admin/tenants | List all tenants |
| GET | /api/super-admin/tenants/:id | Get tenant by ID |
| POST | /api/super-admin/tenants | Create tenant (with branding) |
| PUT | /api/super-admin/tenants/:id | Update tenant (including branding) |
| PUT | /api/super-admin/tenants/:id/branding | Update branding only |
| DELETE | /api/super-admin/tenants/:id | Delete tenant |
| GET | /api/super-admin/scanners | List all scanners |
| GET | /api/super-admin/logs | Get system logs |

---

## ✅ Development Rules

### UI
- Use Tailwind CSS
- Clean spacing (p-4, p-6, gap-4, gap-6)
- Mobile-responsive with lg: breakpoint

### Branding
- Always resolve branding from tenant context
- Never hardcode colors (use CSS variables from branding)
- Support fallback to DEFAULT_BRANDING

### Coding
- NO hardcoding - use mockData.ts
- Always use tenant_id
- TypeScript strict mode

### Git
- Conventional commits: `type(scope): message`
- Example: `feat(super-admin): add per-tenant branding`

---

## 🚀 Migration: Plan → Branding

### Phase 1: Add branding field (backward compatible)
- Add `branding` field to Tenant schema
- Existing tenants get `null` branding (falls back to defaults)
- Keep `plan` field for audit trail

### Phase 2: Default branding population
- Run migration to populate branding from plan
- free → default branding with limited customization
- pro → extended branding options
- enterprise → full customization

### Phase 3: Remove plan dependency
- Remove plan-based feature checks
- Update admin UI to use branding editor
- Archive `plan` field for historical data

### Rollback Plan
1. Keep `plan` field in database
2. Feature flag for branding mode
3. Revert to plan-based theming if issues

---

## 🚀 Running the App

```bash
npm install
npm run dev
```

Access at: http://localhost:3000