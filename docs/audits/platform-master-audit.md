# Platform Master Audit — RemedyGCC

**Date**: 2026-05-16  
**Purpose**: Deep architectural, workflow, and UX audit of the RemedyGCC platform  
**Context**: Tenant-centric multi-tenant survey platform — NOT enterprise reusable survey ecosystem

---

## SECTION 1 — PLATFORM OVERVIEW

### Current Structure

The RemedyGCC platform comprises two primary applications:

1. **Super Admin App** (`remedygcc-admin`)
   - Tenant management (create, edit, publish, archive, restore, delete)
   - Scanner builder (create, edit, duplicate, version)
   - Attribute template builder (hierarchical structure)
   - Branding configuration
   - Runtime publishing and activation
   - Dashboard and analytics
   - Super admin authentication

2. **Runtime Tenant App** (`tenantapp`)
   - Public survey runtime
   - Dynamic branding injection
   - Dynamic scanner rendering
   - Submission collection
   - Dashboard rendering with aggregation

### Architectural Direction (Observed)

The system was built with an **immutable publishing model** where:
- Tenants own runtime configurations that are snapshots
- Scanners are versioned and can be frozen
- Attribute templates are versioned at tenant scope
- Branding is versioned alongside scanner/template versions
- Submissions reference the exact runtime config that was active at submission time

### Where Platform Became Overengineered vs. Actual Business Needs

| Architectural Feature | Intended Purpose | Actual Business Need | Gap |
|---|---|---|---|
| Deep scanner versioning | Support scanner evolution without breaking live surveys | Most tenants operate 1-2 scanners, rarely change after publishing | Overengineered for tenant-centric usage |
| Immutable runtime configs | Preserve submission context | Submissions are tenant-scoped, rarely need historical resolution | Complex for simple tenant operations |
| Scanner/Attribute template decoupling | Flexibility in composition | Templates almost always paired with specific scanners | Unnecessary abstraction |
| Branding version lineage | Historical branding audit | Tenants rarely need to revert branding | Hidden complexity |
| Calculation version references | Future scoring flexibility | Currently hardcoded placeholder | Premature abstraction |

### Observed Architectural Drift

The system exhibits drift between:
- **Business reality**: Tenants operate independently, rarely share scanners, prefer simplicity
- **Architectural model**: Enterprise-grade version control, immutable snapshots, complex lineage

---

## SECTION 2 — TENANT LIFECYCLE AUDIT

### Tenant Creation Flow

**Process**: Name → Slug → Subdomain → Branding (optional) → Scanner selection → Attribute template selection → Publish

**Issues Identified**:
1. **Multi-step wizard missing**: Users must navigate between tenant edit and publishing separately
2. **Scanner/template coupling unclear**: Users don't understand why scanner choice matters for attribute template
3. **Branding defaults confusing**: "Default theme" vs. "Custom theme" unclear what changes behavior
4. **Draft state purpose unclear**: New tenants start as "draft" but unclear whatDraft" means vs. "disabled" vs. "archived"

### Tenant Editing Flow

**Process**: Edit details → Change branding → Switch scanner/template → Save

**Issues Identified**:
1. **Slug/subdomain locking confusing**: After publishing, identity becomes locked — users may not understand why
2. **Status transitions unclear**: "Disable before archive" rule hidden in validation
3. **Draft changes don't affect live**: Editing draft scanner doesn't affect live survey — this is correct but confusing UX

### Publish Flow

**UX Terminology Issues**:
- "Publish survey" — creates runtime config snapshot
- "Make survey live" / "Activate" — points tenant to runtime config
- "Publish and activate" — combined action
- "Re-activate" — switches between published configs

**Cognitive Overload**:
1. Users must understand: snapshot → activate → live
2. Preview shows what will be published but fingerprint matching adds confusion
3. "Existing match" warning says "settings already match a previously published survey" — unclear action

### Archive/Restore/Delete Flow

**Archive**:
- Requires "disable" first
- Changes subdomain to `archived_<slug>_<date>`
- Keeps all historical data

**Restore**:
- Can restore to original subdomain (if available) or new subdomain
- Returns to "disabled" status (not "active")

**Delete**:
- Only allowed for draft tenants with no submissions and no published configs
- Requires typing tenant slug for confirmation

**Issues**:
1. **Archive flow has hidden prerequisite**: Must disable first — error message not clear until attempt
2. **Restore subdomain confusion**: Users must understand archived subdomain vs. new subdomain
3. **Delete restrictions hidden**: Complex conditions prevent delete — user discovers limits when attempting

### Runtime Activation

- Active tenant has `activeRuntimeConfigId` pointing to a published runtime config
- Multiple runtime configs can exist (history)
- Activation is a pointer switch, not a re-publish

**Issues**:
1. **Multiple runtime configs confusing**: Users see list of "published surveys" but don't understand difference between published and active
2. **Re-activating old snapshot unclear**: Can make old published survey live again — useful but hidden

### Subdomain Ownership

- Subdomain must be unique across platform
- Locked after publish or submissions

**Issues**:
1. **Locked state not visible**: No clear indicator in UI that subdomain cannot change
2. **Archived subdomain pattern confusing**: `archived_<original>_<date>` format is internal knowledge exposed

---

## SECTION 3 — SCANNER SYSTEM AUDIT

### Scanner Builder UX

**Structure**: 5-step builder (Structure → Content → Weights → Follow-ups → Review)

**Issues**:
1. **Step navigation unclear**: Users can jump between steps but changes may affect multiple steps
2. **Draft vs. published separation**: Editing creates/updates draft version — not clear when draft becomes "new version"
3. **Version history UI buried**: Accessible via "Version History" but users may not discover
4. **Question validation scattered**: Issues panel shows problems but not integrated into workflow

### Scanner Editing Flow

**Behavior**:
- Published scanners can be edited → creates new draft version
- Draft version can be edited independently
- Publishing creates new version number

**Issues**:
1. **Version number semantics unclear**: What does v1 → v2 mean? When should new version be created?
2. **Change impact indicator shows breaking changes** — useful but may confuse non-technical admins
3. **Duplicate scanner flow buried**: Hidden in "More actions" menu, unclear when to use
4. **Submission protection warnings unclear**: "This scanner has responses" warning appears but implications not explained

### Versioning Assumptions

**Current Model**:
- Draft version (working copy)
- Published version (live)
- Archived version (historical)
- Version numbers auto-increment on publish

**Issues**:
1. **Versioning overkill**: Most tenants use 1-2 versions max, deep version history unnecessary
2. **Version comparison unavailable**: Cannot see diff between versions
3. **Archived versions hidden**: Accessible but not discoverable
4. **Active vs. published vs. draft**: Three-way status creates confusion

### Scanner Lifecycle

**States**: draft → published → archived

**Issues**:
1. **Archive purpose unclear**: Why archive a scanner? When would I want this?
2. **Draft-to-published transition hidden**: Not clear that publishing creates immutable snapshot
3. **No "unpublish"**: Can disable tenant but cannot "unpublish" scanner

### Business-Rule Mismatches

| Business Need | Current Implementation | Gap |
|---|---|---|
| Quick scanner update | Must create new version, publish, activate tenant | Too many steps for simple updates |
| Scanner sharing | Version coupling makes sharing complex | Designed for isolation not collaboration |
| Scanner rollback | Can activate old runtime config | Cannot revert scanner itself |
| Scanner duplication | Exists but buried | Unclear when to duplicate vs. edit |

---

## SECTION 4 — ATTRIBUTE TEMPLATE AUDIT

### Hierarchy Structure

**Model**: Stream → Location → Function → Department (4-level hierarchy)

**Current UI**: Tab-based interface with mapping inputs for each level

### Stream → Location → Function → Department Flow

**Issues**:
1. **Hierarchy purpose unclear**: Why these four levels? What if tenant needs different structure?
2. **Mapping UX complex**: Each level has mapping inputs — not clear what mappings do
3. **No validation of hierarchy**: Can create invalid or inconsistent hierarchies
4. **Runtime behavior hidden**: How these map to survey questions not visible in builder

### Filtering UX

- Templates can filter which attributes appear in runtime
- Filtering happens at template level, not scanner level

**Issues**:
1. **Filtering confused with hierarchy**: Users don't understand relationship
2. **Preview unavailable**: Cannot see what filtered template looks like in runtime

### Runtime Usability

- Template embedded in runtime config
- Scanner references template ID
- Runtime uses mapped attributes for response validation

**Issues**:
1. **Template-scanner coupling invisible**: When selecting scanner, template constraints not shown
2. **Template version at tenant scope**: Each tenant gets own version — not clear this is happening

### Admin Usability

- Template list shows basic stats
- Edit page has all mapping options

**Issues**:
1. **No template preview**: Cannot see what template looks like populated
2. **Template duplication unavailable**: Must recreate from scratch
3. **Template status unclear**: No draft/published equivalent — just exists

---

## SECTION 5 — BRANDING SYSTEM AUDIT

### Branding Creation Flow

**Process**: Tenant edit → Branding section → Configure colors, logo, app name, theme

### Branding Defaults

- Default branding provided (primary color, logo, app name)
- Can override any or all fields

**Issues**:
1. **Default vs. custom distinction unclear**: What triggers "custom" vs. "default"?
2. **Theme selection hidden**: Light/dark/neutral options not prominent
3. **Preview insufficient**: Cannot see branding as end-user would see it

### Branding Warnings

System generates warnings for:
- Missing logo
- Inconsistent contrast ratios
- Missing app name

**Issues**:
1. **Warning severity unclear**: Are these blocking? Informational? Aesthetic?
2. **Warnings don't prevent publish**: Can still publish with warnings
3. **Warning resolution unclear**: How to fix each warning not explained

### Runtime Preview Clarity

- Preview available in tenant detail page
- Shows scanner preview with branding applied

**Issues**:
1. **Preview is static snapshot**: Doesn't show dynamic behavior
2. **Preview quality vs. actual**: May differ from actual runtime
3. **Multiple previews confusing**: Branding preview + scanner preview + publishing preview

### Fallback Behavior

- Default branding used if tenant branding incomplete

**Issues**:
1. **Fallback not visible**: Admin doesn't know what defaults will apply
2. **Default branding fixed**: Cannot customize defaults globally

---

## SECTION 6 — RUNTIME PUBLISHING AUDIT

### Publish Terminology

**Terms Used**:
- Publish survey
- Make live / Activate
- Runtime config
- Published survey
- Active survey

**Issues**:
1. **"Runtime config" is internal jargon**: Exposed in advanced sections but confusing
2. **"Survey" vs "tenant" vs "runtime config"**: Three concepts for one thing
3. **"Publish" vs "Activate" distinction**: What exactly happens in each?

### Runtime Config Visibility

- Shows list of published configs with timestamps
- Shows status (active/published)
- Shows submission count

**Issues**:
1. **Config list is technical**: Shows fingerprint IDs, version references — not user-friendly
2. **Config comparison unavailable**: Cannot see what changed between configs
3. **Config deletion unavailable**: Historical configs accumulate

### Immutable Snapshot Complexity

**Model**: Each publish creates immutable snapshot containing scanner version, template version, branding version

**Issues**:
1. **Snapshot concept hidden but present**: Users benefit from immutability but don't understand it
2. **Version references unclear**: Shows "scannerVersionId: scanver_abc123" — meaningless to admins
3. **Fingerprint matching confusing**: "These settings already match a previously published survey" — what should I do?

### Publish UX

**Current Flow**:
1. Select scanner and template
2. Preview shows what will be included
3. Warnings shown
4. Click "Publish survey"
5. Optionally auto-activate or manually activate later

**Issues**:
1. **Preview requires clicking "Preview"**: Not automatically shown
2. **Blocking vs. non-blocking issues unclear**: Some prevent publish, some are warnings — distinction not clear
3. **Existing match detection hidden**: Detects identical settings but users don't know this happens
4. **Activation is second step**: Publish → Activate is two actions but conceptually one outcome

### Activation Flow

- Can activate any previously published config
- Can disable tenant (deactivates but keeps config)
- Can reactivate later

**Issues**:
1. **Activation UI unclear**: Checkbox or dropdown — inconsistent
2. **"Make live" vs. "Activate" terminology mixed**
3. **Disable ≠ deactivate**: Disabling stops access but doesn't unpublish

### Runtime Safety Assumptions

- Immutability protects submissions
- Version references preserve context
- Re-activation is safe

**Issues**:
1. **Safety not communicated**: Admins don't know why system is designed this way
2. **No emergency rollback**: If published config is bad, must wait for new publish

---

## SECTION 7 — DASHBOARD SYSTEM AUDIT

### Runtime Dashboard

- Shows aggregated results for tenant
- Depends on submitted responses
- Requires scanner and template to render

### Aggregation Assumptions

- Responses aggregate to category/subdomain/question level
- Scores calculated based on weights
- Dashboard shows trends over time

**Issues**:
1. **Aggregation hidden**: How scores calculated not visible in dashboard
2. **Time-based trends unclear**: What time periods available? How determined?
3. **Empty state confusing**: No responses yet vs. no scanner selected

### Scanner Dependency Assumptions

- Dashboard requires published scanner
- Scanner changes don't retroactively affect dashboard
- Version references keep historical accuracy

**Issues**:
1. **No dashboard for draft scanner**: Cannot preview dashboard during editing
2. **Dashboard version locked**: Shows data from active runtime config only

### Submission Relationships

- Each submission linked to runtime config
- Submissions preserved when scanner updated

**Issues**:
1. **Submission count visible**: But what does it represent? Current scanner? All time?
2. **Submission access unavailable**: Cannot view individual responses in admin

---

## SECTION 8 — AUTHENTICATION AUDIT

### Super Admin Auth UX

**Implemented**:
- Session-based authentication (NOT JWT)
- bcrypt password hashing
- MongoDB-backed sessions with TTL
- HttpOnly, Secure cookies
- Middleware route protection
- Login page with validation

**Issues**:
1. **No password requirements**: Any password accepted
2. **No account lockout**: Brute force possible
3. **No password reset flow**: Must edit database to recover
4. **Session duration fixed**: 7 days, cannot customize per-admin

### Session Flow

- Login → Create session → Set cookie → Validate on each request
- Logout → Delete session → Clear cookie

**Issues**:
1. **Single session only**: New login invalidates existing sessions — correct but not communicated
2. **Session refresh unclear**: Does using the app extend session? When does it expire?

### Middleware Boundaries

- Middleware validates cookie format (Edge-compatible)
- API routes validate actual session in database

**Issues**:
1. **Double validation overhead**: Format check in middleware, DB check in routes
2. **No session activity tracking**: Last access updated but not surfaced to admin

### Future Tenant Auth Implications

- Currently tenant runtime is public (no tenant-level auth)
- Auth docs mention "tenant portal assumptions" as area of concern

**Risks**:
1. **No tenant user auth**: Would require significant new architecture
2. **Auth boundary unclear**: Where does super admin end and tenant begin?

---

## SECTION 9 — UI/UX AUDIT

### Navigation

**Sidebar Navigation**: Dashboard | Tenants | Scanners | System Logs | Attribute Templates | Settings

**Issues**:
1. **System Logs unexpected**: Log viewing is admin task but feels out of place
2. **Settings location unclear**: What settings exist? Global vs. per-tenant?
3. **No breadcrumb navigation**: Deep pages lack context

### Action Placement

- Primary actions often in header
- Secondary actions in "More" menus
- Dangerous actions (delete, archive) require confirmation

**Issues**:
1. **Publish button location inconsistent**: Sometimes in panel, sometimes in header
2. **Save vs. Publish confusion**: When to save draft vs. publish?
3. **Edit vs. View modes unclear**: When does clicking name edit vs. view?

### Terminology

| Term | Usage | Issue |
|---|---|---|
| Tenant | Primary entity | Could be "project", "survey", "instance" |
| Scanner | Survey definition | Could be "form", "survey", "questionnaire" |
| Attribute Template | Response structure | "Template" overloaded |
| Publish | Make live | "Deploy", "release", "activate" also used |
| Runtime | Live environment | "Live", "production", "public" also used |

### Cognitive Overload Areas

1. **Tenant detail page**: Many panels — publishing, branding, details, technical — overwhelming
2. **Scanner builder**: 5 steps with complex interactions between steps
3. **Publishing flow**: Preview, warnings, activation all separate

### Dangerous Action UX

- Delete requires typing slug
- Archive requires disable first
- Status change confirmation required

**Issues**:
1. **Confirmation requirements inconsistent**: Some require type, some click, some nothing
2. **Undo unavailable**: Delete is permanent, archive is permanent

### Dashboard Clarity

- Stats shown: total tenants, active, disabled, archived, submissions
- No trend visualization
- No drill-down available

---

## SECTION 10 — OVERENGINEERING AUDIT

### MOST CRITICAL SECTION

#### 1. Deep Scanner Versioning

**Why Overengineered**:
- Implemented full draft/published/archived version model
- Each version creates full copy of scanner structure
- Version history with stats, but no diff available

**Real Business Need**:
- Most tenants use 1-2 versions
- Simple edit → republish is sufficient
- Version history useful for audit but not primary workflow

**Recommended Simplification**:
- Remove version numbers from primary UI
- Show "Last updated" timestamp instead
- Keep version history behind "History" but simplify to list
- Allow "reset to published" without version management

#### 2. Runtime Config Fingerprinting

**Why Overengineered**:
- Complex fingerprint matching to detect "existing match"
- Shows technical fingerprints in UI
- Version references (scannerVersionId, attributeTemplateVersionId, etc.)

**Real Business Need**:
- Simple "have you published before?" check
- Warn if re-publishing same content

**Recommended Simplification**:
- Replace fingerprint matching with simple content hash
- Hide version IDs from UI
- Show "Previously published" without technical detail

#### 3. Branding Version Lineage

**Why Overengineered**:
- Branding version ID tracked separately
- Fingerprint for branding maintained
- Version resolution at publish time

**Real Business Need**:
- Branding rarely changes after publish
- Simple current branding is sufficient

**Recommended Simplification**:
- Remove branding version tracking
- Show branding timestamp instead
- No version history for branding

#### 4. Attribute Template Versioning

**Why Overengineered**:
- Template versions created at tenant scope
- Each tenant gets independent version
- Version matching used to detect reuse

**Real Business Need**:
- Template assigned to tenant, rarely changes
- Simple "current template" is sufficient

**Recommended Simplification**:
- Remove tenant-scoped template versioning
- Reference template directly, not version
- No template version history per tenant

#### 5. Immutable Snapshot Complexity

**Why Overengineered**:
- Runtime config contains full copy of scanner, template, branding
- Immutable once created
- Can reactivate old configs

**Real Business Need**:
- Submissions need stable survey definition
- Simple "current published version" sufficient

**Recommended Simplification**:
- Single "current published version" per tenant
- No historical config list (or bury it)
- Republish replaces current, no activation switching

#### 6. Calculation Version References

**Why Overengineered**:
- `CALCULATION_VERSION_ID = 'calc_demo_placeholder_v1'` — hardcoded placeholder
- Tracked in runtime config but not implemented

**Real Business Need**:
- Currently no calculation versioning needed
- Placeholder for future

**Recommended Simplification**:
- Remove calculation version from UI
- Add comment that this is placeholder for future scoring changes

---

## SECTION 11 — BUSINESS RULE ALIGNMENT AUDIT

### Current Architecture vs. Real Workflows

| Workflow | Architecture | Reality | Alignment |
|---|---|---|---|
| Create new tenant | Must select scanner + template first | Usually want to start with empty, fill in later | Partial |
| Publish survey | Complex preview, fingerprint check, publish → activate | Just want to make it live | Poor |
| Update survey | Create new version, publish, activate | Just want changes to appear | Partial |
| Switch scanner | Must publish new config | Should just swap | Poor |
| Rollback survey | Reactivate old config | Complex, hidden | Poor |
| Archive tenant | Disable first, then archive | Not obvious prerequisite | Poor |

### Admin Mental Model vs. System

**What Admin Expects**:
1. Create tenant → Add scanner → Customize branding → Go live
2. Edit scanner → Changes appear in live survey
3. Switch to different scanner → Live survey updates

**What System Does**:
1. Create tenant → Select scanner+template → Draft state → Publish → Activate
2. Edit scanner → Creates new version → Must publish separately
3. Switch scanner → New runtime config required → Publish again

**Gap**: System forces publish/republish flow for every change, but admins expect immediate effect from editing.

---

## SECTION 12 — RISK ANALYSIS

### Dangerous Future Complexity

1. **Tenant auth expansion**: Adding tenant-user auth would require significant new architecture
2. **Scanner sharing**: Current isolation-first design makes sharing difficult
3. **Multi-environment**: No dev/staging/prod separation
4. **Scanner evolution**: Deep versioning may become unmaintainable

### Maintainability Risks

1. **Service file size**: Tenant service.ts is 1200+ lines — too large
2. **Mongo repository complexity**: Multiple collections with complex relationships
3. **Test coverage unknown**: No tests visible in codebase

### Scaling Risks

1. **Runtime config accumulation**: Each publish creates new config, no cleanup
2. **Version history growth**: Scanners accumulate versions indefinitely
3. **Query complexity**: Detail queries require multiple joins across collections

### Operational Confusion Risks

1. **Status state machine**: Draft → active → disabled → archived has complex rules
2. **Publish/activate confusion**: Two-step process not understood
3. **Version vs. status mixing**: Scanner has version number AND status

### Migration Risks

1. **Hardcoded calculation version**: Changing requires migration
2. **Fingerprint algorithm changes**: Would break matching
3. **No export/import**: Cannot move tenants between instances

---

## SECTION 13 — RECOMMENDED SIMPLIFICATION STRATEGY

### Scanner Lifecycle

**Recommended**:
- Remove version numbers from primary UI
- Single "current published version" concept
- Edit → Save → auto-publish (or simple "publish" button)
- Remove "draft version" concept from admin view

### Tenant Lifecycle

**Recommended**:
- Single "live" vs. "disabled" status (remove archive)
- "Delete" available for any tenant without submissions
- Simplify subdomain locking — just lock after first submission
- Remove "archived_" prefix pattern

### Runtime Publishing

**Recommended**:
- Single "current published config" not list
- "Publish" means "make this the live version"
- Remove activation concept
- No re-activation of old configs

### Duplication Workflows

**Recommended**:
- Make "Duplicate" primary action, not buried
- Clarify when to duplicate vs. edit

### Dashboard Ownership

**Recommended**:
- Move to separate "Analytics" section
- Show basic stats per tenant
- Aggregate platform stats in dashboard

### Tenant Auth

**Recommended**:
- Defer tenant-user auth to Phase 2
- Keep tenant runtime public for now
- Document auth boundary

### Operational UX

**Recommended**:
- Single action for "go live" (not publish + activate)
- Clear status indicators (draft/active/disabled)
- Remove technical details from primary UI
- Add tooltips explaining concepts

---

## SECTION 14 — PRIORITY MATRIX

### Critical (Must Fix Immediately)

| Issue | Impact | Effort |
|---|---|---|
| Publish/activate confusion | Users cannot go live | Medium |
| Tenant status transition rules hidden | Users hit errors | Low |
| Scanner editing doesn't affect live | Expect immediate effect | Medium |
| Delete restrictions unclear | Data loss risk | Low |

### Important (Should Fix Soon)

| Issue | Impact | Effort |
|---|---|---|
| Version numbers visible | Cognitive load | Low |
| Fingerprint matching hidden | Confusion when re-publishing | Medium |
| Branding preview insufficient | Cannot verify changes | Medium |
| Attribute template mapping unclear | Template setup fails | High |

### Future (Can Wait)

| Issue | Impact | Effort |
|---|---|---|
| Scanner version diff | Nice to have | High |
| Runtime config comparison | Nice to have | High |
| Dashboard drill-down | Analytics limitation | Medium |
| Multi-environment | Not needed yet | High |

---

## SECTION 15 — RECOMMENDED NEXT PHASES

### Phase 1: Workflow Stabilization (Week 1-2)

1. Simplify publish flow — single "Go Live" action
2. Clarify tenant status — remove archive or make simpler
3. Fix scanner editing expectation — explain versioning or simplify
4. Add clear status indicators throughout UI

### Phase 2: UI/UX Cleanup (Week 3-4)

1. Remove version numbers from primary UI
2. Simplify tenant detail page — fewer panels
3. Improve branding preview — show as end-user would see
4. Add tooltips for confusing terms

### Phase 3: Architecture Simplification (Week 5-8)

1. Remove runtime config list — single current config
2. Simplify scanner versioning — remove version numbers
3. Remove branding/template versioning — simple references
4. Clean up service files — split large files

### Phase 4: Documentation (Week 9+)

1. Write admin-facing docs explaining the model
2. Create video tutorials for common workflows
3. Document edge cases and how to handle

---

## APPENDIX: KEY FILE REFERENCES

### Tenant System
- `src/modules/tenant/service.ts` (1285 lines)
- `src/modules/tenant/types.ts`
- `src/modules/tenant/components/TenantPublishingPanel.tsx`
- `src/app/tenants/page.tsx`

### Scanner System
- `src/modules/scanner/service.ts`
- `src/modules/scanner/types.ts`
- `src/modules/scanner/components/ScannerForm.tsx`
- `src/modules/scanner/components/VersionHistory.tsx`

### Attribute Template System
- `src/modules/attribute-template/service.ts`
- `src/modules/attribute-template/types.ts`
- `src/modules/attribute-template/components/TemplateForm.tsx`

### Branding System
- `src/types/branding.ts`
- `src/components/tenants/BrandingEditor.tsx`

### Publishing Engine
- `src/modules/publishing/engine.ts`

### Auth System
- `src/modules/auth/service.ts`
- `src/server/auth/repository.ts`
- `src/middleware.ts`

---

**END OF AUDIT**

This document should be the source of truth for all future platform work. Before implementing any feature, reference this audit to ensure alignment with business reality vs. architectural complexity.