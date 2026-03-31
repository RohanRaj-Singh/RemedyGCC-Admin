# RemedyGCC Quick Reference

> Quick rules for all RemedyGCC development

---

## 🎯 Core Principles

1. **Senior Engineer Mindset** - Act as a senior engineer, not a junior
2. **No Hallucination** - Do not invent APIs or features not in scope
3. **Follow Architecture** - Strictly follow architecture.md
4. **Keep It Simple** - Avoid over-engineering
5. **Production Quality** - Treat all code as production-grade
6. **Branding-first** - Per-tenant branding replaces legacy plan system

---

## 🔑 Key Constraints

### Multi-tenancy
- Each tenant has ONLY ONE scanner at a time
- ALL data must be scoped by tenant_id
- Never expose another tenant's data

### Branding (Replaces Plan System)
- Each tenant has a `BrandingConfig` instead of a plan tier
- Branding includes: logoUrl, colorScheme, fontFamily, assets
- Default branding applied when tenant has no custom branding
- Tenant isolation is mandatory for branding data

### Survey System
- Questions, options, and weights are dynamic
- Weighted scoring system for results
- Survey can be customized per tenant

---

## 🏗️ Domain Architecture

| Domain | Purpose |
|--------|---------|
| remedygcc.com | Marketing + Organization Dashboard |
| admin.remedygcc.com | Super Admin Panel |
| {tenant}.remedygcc.com | Survey Interface |

---

## 📁 Project Structure

```
src/                    # Next.js app source
ai-context/             # Lightweight AI context
ai-context-pack/        # Expanded AI context and handoff pack
```

---

## ✅ Code Standards

### Naming
- Folders: kebab-case (super-admin, tenant-dashboard)
- Variables: camelCase (tenantId, totalSubmissions)
- Components: PascalCase (TenantTable, ScannerCard)

### Git Commits
```
type(scope): message
- feat(admin): add tenant CRUD
- fix(scanner): correct weight calculation  
- refactor(ui): simplify dashboard layout
```

---

## 📋 Before Starting Any Task

1. ✅ Read architecture.md
2. ✅ Read system_identity.md
3. ✅ Read relevant module context
4. ✅ Read rules files
5. ✅ Check `ai-context-pack/handoffs/current_state.md` for latest app-specific handoff notes

## Current Super Admin Reality

- The app already contains working tenant, scanner, dashboard, and logs surfaces
- Tenant branding replaces legacy plan-tier theming
- The tenant edit page uses a split editing model with a dedicated live preview card
- When changing tenant UX, update the AI context markdown files so future agents inherit the new mental model

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, Tailwind CSS |
| Backend | Laravel API |
| Database | MongoDB |
| Queue | Redis |

---

## 📞 Need Help?

- Architecture: `ai-context/global/architecture.md`
- System Identity: `ai-context/global/system_identity.md`
- Module Context: `ai-context/modules/{module-name}/`
- Rules: `ai-context/rules/`
