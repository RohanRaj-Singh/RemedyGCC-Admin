# Tenant Workflow Architecture

## Overview

This document describes the simplified tenant workflow architecture, explaining what's visible to admins vs. what's kept internal as backend safety.

---

## Simplified Lifecycle

### 1. Create Tenant
```
Input: name, subdomain
Output: Tenant in "Draft Setup" status
```

The tenant is created with minimal initial configuration. It exists in the system but cannot be accessed by respondents.

### 2. Configure Survey
```
Input: scanner ID, attribute template ID
Output: Tenant with connected survey definition
```

Admins connect a scanner (survey questions) and attribute template (response structure). This happens through the edit flow.

### 3. Customize Branding (Optional)
```
Input: colors, logo, app name, theme
Output: Tenant with custom appearance
```

Admins can customize how the survey looks to respondents. Defaults are provided if not customized.

### 4. Preview
```
Input: current configuration
Output: Visual preview of survey appearance
```

Before going live, admins can see what the survey will look like to respondents.

### 5. Go Live
```
Input: ready configuration
Output: Tenant in "Live" status, survey publicly accessible
```

**This is the simplified action.** Internally:
- Creates immutable snapshot
- Sets as active runtime
- Makes survey accessible at subdomain

One button, not "Publish + Activate."

### 6. Monitor & Manage
```
Operations: Disable, Archive, Restore, (Delete if Draft)
```

After going live, admins can manage the survey lifecycle:
- **Disable**: Temporarily stop access, preserve data
- **Archive**: Close for record-keeping, release subdomain
- **Restore**: Bring archived survey back to operational state
- **Delete**: Only for draft tenants with no data

---

## What Happens Internally (Hidden)

The following architecture remains in place but is NOT shown to admins:

### Immutable Snapshots

Each "Go Live" creates:
- Scanner version snapshot (frozen copy of questions)
- Attribute template version snapshot (frozen copy of structure)
- Branding version snapshot (frozen copy of appearance)
- Runtime config (composite snapshot)

These are stored in MongoDB and NEVER modified after creation.

### Submission References

When a respondent submits answers:
- The submission is linked to the active runtime config ID at time of submission
- Even if survey is updated later, historical submissions always reference their original survey version
- Dashboard aggregation uses these references for stability

### Runtime Safety

- **No silent updates**: Changing scanner doesn't affect live survey automatically
- **Historical integrity**: Old submissions always render with original questions
- **Rollback capability**: Can switch between previously published versions (support feature)

### Version Tracking (Internal)

The backend still tracks:
- Scanner versions per tenant
- Template versions per tenant
- Branding versions
- Runtime config history

But this is used for:
- Submission stability
- Support/debugging
- Not for primary admin workflow

---

## Internal vs. External Mapping

| Admin Sees | Internal Actually Happens |
|---|---|
| Click "Go Live" | Creates immutable snapshot + activates |
| "Live" status | activeRuntimeConfigId points to latest snapshot |
| Change scanner | Creates new draft configuration |
| Click "Go Live" again | Creates new immutable snapshot + updates active pointer |
| "Disabled" status | activeRuntimeConfigId preserved, status changed to disabled |
| "Archive" | Status → archived, subdomain → released |
| "Restore" | New configuration created, subdomain reassigned |

---

## Security & Safety Preserved

Even with simplified UX, these remain:

1. **Submission stability**: Responses never "break" due to survey changes
2. **Historical audit**: Can always see what survey looked like at any point
3. **Data preservation**: Disable/archive preserve all submissions
4. **Deletion protection**: Only draft tenants without data can be deleted
5. **Subdomain locking**: Prevents confusion after going live

---

## Page Structure

### Tenant Detail Page Layout

```
┌─────────────────────────────────────────┐
│  Header: Back button + Edit button     │
├─────────────────────────────────────────┤
│  Title: Tenant name                     │
│  Subdomain: xxx.remedygcc.com          │
├─────────────────────────────────────────┤
│  STATUS BANNER                         │
│  [Draft/Live/Disabled/Archived]        │
│  [Go Live Button]                       │
├─────────────────────────────────────────┤
│  QUICK STATS                           │
│  Responses | Last Updated | Scanner | Template │
├──────────────────┬──────────────────────┤
│  LEFT COLUMN    │  RIGHT COLUMN       │
│                  │                      │
│  Survey Config  │  Branding Preview   │
│  - Scanner       │  - Theme preview    │
│  - Template      │                      │
│                  │  Subdomain Info      │
│  Operations     │  - URL display       │
│  - Disable      │  - Lock status       │
│  - Archive       │                      │
│  - Restore       │                      │
│  - Delete        │                      │
└──────────────────┴──────────────────────┘
```

**Key Simplifications**:
- No "Technical Details" section
- No "Published Survey History" list
- No runtime config IDs shown
- No fingerprint/match detection exposed
- Single "Go Live" action instead of Publish + Activate

---

## API Flow

### Go Live (Simplified)

```
POST /api/super-admin/tenants/:id/publish
Body: { activate: true }

Response: Tenant with activeRuntimeConfigId set, status = "active"
```

The API internally:
1. Validates scanner + template connected
2. Creates scanner version document
3. Creates attribute template version document
4. Creates runtime config composite
5. Sets as active
6. Updates tenant status

All in one call, one response.

### Status Change

```
PUT /api/super-admin/tenants/:id
Body: { status: "disabled" | "active" | "archived" }
```

Simple status transitions, no complex state machine exposed.

---

## Error Handling

Errors are translated to business language:

| Internal Error | User Message |
|---|---|
| Missing scanner | "Connect a scanner to go live." |
| Missing template | "Connect an attribute template to go live." |
| Subdomain taken | "Subdomain 'x' is already in use." |
| Identity locked | "Subdomain cannot be changed after going live." |

---

## Testing This Architecture

### What Should Work
- Create tenant → configure → go live flow
- Disable → re-enable flow
- Archive → restore flow
- Subdomain locking after live
- Submission preservation through status changes

### What Should Be Invisible
- Snapshot creation mechanics
- Version ID generation
- Fingerprint matching
- Runtime config management

---

## Summary

The simplified workflow:
1. Keeps all safety architecture internally
2. Removes jargon from admin-facing UI
3. Provides single "Go Live" action
4. Separates operational controls
5. Shows clear status with explanations

Admins get a clean survey management experience. The system gets immutable safety and submission stability.