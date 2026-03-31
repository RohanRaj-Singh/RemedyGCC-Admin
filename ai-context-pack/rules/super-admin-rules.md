# RemedyGCC Super Admin Module Rules

> Kilo Code Rules File - Read this before working on super-admin module

---

## 📋 Context Summary

**Project**: RemedyGCC - Multi-tenant SaaS Health Intelligence Platform  
**Domain**: admin.remedygcc.com  
**Module**: Super Admin Control Plane

### Core Modules
- Super Admin (you are here)
- Scanner Engine (core logic)
- Submission System  
- Tenant Dashboard
- **Per-tenant White-label Branding** (NEW)

### Architecture
- remedygcc.com → marketing + organization dashboard
- admin.remedygcc.com → super admin panel
- {tenant}.remedygcc.com → survey interface (branded per tenant)

---

## ⚠️ Constraints (MUST FOLLOW)

1. **One scanner per tenant** - Each tenant can only have ONE active scanner at a time
2. **No direct DB access** - Frontend cannot access database directly; must use API
3. **Tenant scoping** - ALL data must be filtered by tenant_id
4. **Production-grade** - This is NOT a prototype; treat as production architecture
5. **Per-tenant branding** - Replace legacy plan system with full branding configuration

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS
- **Backend**: Laravel API (to be implemented)
- **Database**: MongoDB
- **Queue**: Redis

---

## 📁 File Structure

```
apps/super-admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Main dashboard
│   │   └── globals.css     # Tailwind + CSS
│   ├── data/
│   │   └── mockData.ts     # Centralized dummy data
│   ├── lib/
│   │   └── utils.ts       # Utilities
│   └── types/
│       └── index.ts        # TypeScript types (includes BrandingConfig)
├── package.json
└── tailwind.config.ts
```

---

## 📊 Data Models

### BrandingConfig (New - replaces plan system)
```typescript
interface BrandingConfig {
  logoUrl: string;                    // Required
  faviconUrl?: string;                // Optional
  colorScheme: ColorScheme;           // Required
  fontFamily?: string;                // Optional
  assets?: BrandingAssets;           // Optional
  metadata?: Record<string, unknown>; // Optional
}

interface ColorScheme {
  primaryColor: string;      // hsl format: "156 63% 16%"
  secondaryColor?: string;   // hsl format
  backgroundColor?: string;  // hsl format
  textColor?: string;        // hsl format
  accentColor?: string;      // hsl format
}

interface BrandingAssets {
  headerImageUrl?: string;
  footerImageUrl?: string;
  customCss?: string;
}
```

### Tenant (Updated - branding replaces plan)
```typescript
interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  branding: BrandingConfig;        // REPLACES plan field
  scannerId: string | null;
  totalSubmissions: number;
  createdAt: string;
  updatedAt: string;
}
```

### Default Branding (Fallback when branding is null)
```typescript
const DEFAULT_BRANDING: BrandingConfig = {
  logoUrl: '/default-logo.svg',
  colorScheme: {
    primaryColor: '156 63% 16%',    // RemedyGCC green
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

## 🎨 Branding Resolution Flow

### Per-Request Resolution
```
Request → Extract tenant_id → Load Tenant.branding
  → If null: Apply DEFAULT_BRANDING → Generate CSS vars
  → Inject into theme context → Render UI
```

### Caching
- Redis cache per tenant_id (TTL: 5 minutes)
- Invalidate on branding update
- No cross-tenant cache sharing

### Security & Isolation
- Branding data scoped by tenant_id
- No cross-tenant data leakage
- URL sanitization for logo/favicon
- CSS injection prevention (no user-provided CSS)
- Audit logging for all branding changes

---

## 🔌 API Contracts

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | /api/super-admin/dashboard | DashboardStats |
| GET | /api/super-admin/tenants | Tenant[] (with branding) |
| GET | /api/super-admin/tenants/:id | Tenant |
| POST | /api/super-admin/tenants | Tenant (with default branding) |
| PUT | /api/super-admin/tenants/:id | Tenant (including branding) |
| PUT | /api/super-admin/tenants/:id/branding | BrandingConfig |
| DELETE | /api/super-admin/tenants/:id | void |
| GET | /api/super-admin/scanners | Scanner[] |
| GET | /api/super-admin/scanners/:id | Scanner |
| POST | /api/super-admin/scanners | Scanner |
| PUT | /api/super-admin/scanners/:id | Scanner |
| DELETE | /api/super-admin/scanners/:id | void |
| GET | /api/super-admin/logs | SystemLog[] |

---

## ✅ Development Rules

### UI Rules
- Use Tailwind CSS for all styling
- Clean spacing with consistent padding/margins (p-4, p-6, gap-4, gap-6)
- Reusable components
- Mobile-responsive (use lg: breakpoint for desktop)

### Branding Rules
- NEVER hardcode colors - use CSS variables from branding
- Always fall back to DEFAULT_BRANDING when branding is null
- Tenant isolation is mandatory
- Validate all branding URLs

### Coding Rules
- **NO hardcoding** - Use centralized mockData.ts
- Always use tenant_id for scoping
- Keep components reusable
- TypeScript strict mode

### Backend Rules
- Always filter by tenant_id
- Use Laravel services
- Thin controllers

### Git Rules
- Use conventional commits: `type(scope): message`
- Examples:
  - `feat(branding): add per-tenant white-label support`
  - `fix(tenant): remove plan references`
  - `refactor(super-admin): update theming to use branding`

---

## 🚀 Migration: Plan → Branding

### Step 1: Add branding field
- Add `branding` field to Tenant schema (nullable)
- Keep `plan` field for audit trail

### Step 2: Migrate existing tenants
```javascript
// Migration script
db.tenants.find({ branding: null }).forEach(tenant => {
  const defaultBranding = planToDefaultBranding[tenant.plan] || DEFAULT_BRANDING;
  db.tenants.updateOne({ _id: tenant._id }, { $set: { branding: defaultBranding } });
});
```

### Step 3: Update admin tooling
- Add branding editor UI in super admin
- Remove plan-based feature checks
- Update dashboard to show branding status

### Step 4: Deprecate plan
- Archive plan field
- Update documentation
- Remove plan-based UI elements

### Rollback Steps
1. Feature flag: `USE_BRANDING=true`
2. If branding fails: `USE_BRANDING=false`
3. Revert to plan-based theming
4. Log incident for review

---

## 🧪 Testing Expectations

### Unit Tests
- BrandingConfig validation
- Default fallback logic
- Color scheme parsing

### Integration Tests
- Branding loaded per tenant
- Tenant isolation verified
- Cache invalidation works

### UI Tests
- Theming applied correctly
- Fallback to defaults works
- Branding editor saves correctly

---

## 🛠️ Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Run tests:
   ```bash
   npm test
   ```

4. Access at: http://localhost:3000

---

## 📝 Notes

- This is a production-grade architecture simulation
- Dummy data is centralized in `/src/data/mockData.ts`
- API contracts are documented for Laravel backend implementation
- UI is built with modern components (Lucide icons, Tailwind CSS)
- Per-tenant branding enables white-label deployment