# Tenant Lifecycle Architecture

## Overview

The tenant lifecycle system manages the complete lifespan of tenants from creation through archiving, with proper state management, subdomain ownership handling, and safety controls.

## Tenant States

### 1. Draft
- **Purpose**: Initial tenant setup phase
- **Characteristics**:
  - Configuration incomplete
  - Not publishable/live
  - Fully editable
  - Subdomain reserved but not active
- **Valid Transitions**: → Active (via publish), → Disabled, → Archived

### 2. Active / Live
- **Purpose**: Operational production tenant
- **Characteristics**:
  - Published runtime active
  - Accessible to respondents
  - Subdomain fully operational
- **Valid Transitions**: → Disabled, → Archived

### 3. Disabled
- **Purpose**: Temporary suspension
- **Characteristics**:
  - Temporarily blocked
  - Runtime inaccessible
  - History preserved
  - Subdomain reserved
- **Valid Transitions**: → Active, → Draft, → Archived

### 4. Archived
- **Purpose**: Historical record only
- **Characteristics**:
  - Non-operational
  - Runtime inaccessible
  - Subdomain RELEASED (becomes reusable)
  - All historical data preserved
  - Can be restored
- **Valid Transitions**: → Disabled (via restore)

## Subdomain Ownership Rules

### States That Reserve Subdomains
- Draft
- Active
- Disabled

### States That Release Subdomains
- Archived

### Subdomain Release Mechanism

When a tenant is archived:
1. Original subdomain is stored internally (for restore reference)
2. Subdomain field is changed to `archived_{originalSlug}_{date}`
3. The original subdomain becomes available for new tenants

Example:
- Original: `rohanraj` → becomes `archived_rohanraj_20260515`
- Original subdomain `rohanraj` is now available for new tenants

## Archive Flow

### Safe Archive Requirements
1. User must explicitly confirm archive action
2. Warning dialog explains:
   - Live survey will be disabled immediately
   - All historical data preserved
   - Subdomain will be released
   - Survey links will stop working
3. System releases subdomain for reuse
4. Tenant status changes to `archived`

### Archive API
```
POST /api/super-admin/tenants/[id]/archive
```

### Archive Side Effects
- `status` → `archived`
- `subdomain` → `archived_{originalSlug}_{date}`
- `archivedAt` → current timestamp
- Runtime configs remain (frozen snapshots preserved)
- Submissions remain (historical data preserved)

## Restore Flow

### Restore Requirements
1. Only archived tenants can be restored
2. Restored tenant goes to `Disabled` state (not directly Active)
3. May require new subdomain if original is taken

### Restore API
```
POST /api/super-admin/tenants/[id]/restore
Body: { "newSubdomain": "optional-new-subdomain" }
```

### Restore Options
- **No subdomain provided**: Try original subdomain, fail if taken
- **Subdomain provided**: Use provided subdomain, fail if taken

## Delete Flow

### Delete Requirements
Tenant can ONLY be deleted if:
- Status is `draft`
- No runtime configurations exist
- No submissions exist
- No active runtime config

### Delete Confirmation
User must type the tenant slug to confirm deletion.

### Delete API
```
DELETE /api/super-admin/tenants/[id]
Body: { "confirmationText": "tenant-slug" }
```

## Runtime Safety

### Middleware Blocking
- **Archived tenants**: Blocked at hostname resolution
- **Disabled tenants**: Blocked, returns "Survey unavailable"
- **Draft tenants**: Not accessible via subdomain
- **Active tenants**: Allowed through

### Data Isolation
- Archived tenant submissions still queryable via historical data
- Dashboard remains functional for archived tenants
- Runtime configs frozen at publish time remain valid

## State Transitions

| From | To | Valid | Notes |
|------|-----|-------|-------|
| Draft | Active | Yes | Via publish flow |
| Draft | Disabled | Yes | Manual status change |
| Draft | Archived | Yes | Via archive flow |
| Active | Disabled | Yes | Manual status change |
| Active | Archived | Yes | Via archive flow |
| Disabled | Active | Yes | Via activate flow |
| Disabled | Draft | Yes | Manual status change |
| Disabled | Archived | Yes | Via archive flow |
| Archived | Disabled | Yes | Via restore flow |

## Service Functions

### archiveTenant(tenantId)
- Validates tenant exists and is not already archived
- Generates archived subdomain: `archived_{slug}_{date}`
- Updates tenant status to `archived`
- Sets `archivedAt` timestamp

### restoreTenant(tenantId, newSubdomain?)
- Validates tenant is archived
- Checks subdomain availability
- If original subdomain taken, requires new subdomain
- Restores to `disabled` state (not `active`)
- Clears `archivedAt`

### deleteTenant(tenantId, confirmationText)
- Validates tenant is deletable (draft, no history)
- Requires slug confirmation
- Permanently removes tenant and versions

## UI Components

### Archive Confirmation Modal
- Explains archive consequences clearly
- Shows warning about subdomain release
- Requires user confirmation
- Provides "Cancel" and "Archive" buttons

### Restore Modal
- Shows current subdomain info
- Allows optional new subdomain input
- Explains restored tenant will be disabled
- Shows error if subdomain taken

### Tenant List Filters
- Filter by: All, Draft, Active, Disabled, Archived
- Clear status indicators for each state
- Shows archived status distinctly