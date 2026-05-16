# Tenant Mental Model

## The Core Concept

A **Tenant** in RemedyGCC should feel like a:

> **Survey Workspace** or **Customer Organization**

NOT:

> A runtime deployment configuration

---

## How Admins Should Think

### Before (Internal Architecture Language)
```
Create tenant
→ Configure runtime settings
→ Create snapshot
→ Publish to runtime
→ Activate configuration
→ Monitor deployment
```

### After (Business Language)
```
Create survey project
→ Connect a scanner (survey questions)
→ Connect attribute template (response structure)
→ Customize appearance
→ Go live
→ Collect responses
```

---

## What Admins See

When an admin opens the platform, they should think:

1. **Create a new survey** (not "create runtime config")
2. **Configure questions** (not "build scanner version")
3. **Customize appearance** (not "configure branding snapshot")
4. **Go live** (not "publish and activate runtime")
5. **See responses** (not "query submission aggregation")

---

## Key Translations

| Internal Term | Admin-Friendly Term |
|---|---|
| Runtime Config | (Hidden - not shown) |
| Publish | Go Live |
| Activate | (Hidden - part of Go Live) |
| Scanner Version | (Simplified to just "Scanner") |
| Attribute Template Version | (Simplified to just "Template") |
| Branding Version | (Simplified to just "Theme") |
| Fingerprint | (Hidden - not shown) |
| Immutable Snapshot | (Hidden - backend safety) |
| Submission Snapshot Reference | (Hidden - backend safety) |

---

## Status Meanings

### Draft Setup
> Setup incomplete. Not publicly accessible.

The survey is being prepared. Respondents cannot access it. This is where you configure everything.

### Live
> Survey publicly accessible. Responses actively collected.

The survey is active at its subdomain. Respondents can submit answers. This is the operational state.

### Disabled
> Temporarily inaccessible. History preserved.

The survey is paused. Respondents cannot access it, but all data and history is preserved. Can be re-enabled anytime.

### Archived
> Historical record only. Subdomain released. Not operational.

The survey is closed for record-keeping. Subdomain is freed for potential reuse. Can be restored to a new subdomain if needed.

---

## Workflow Visualization

```
[Create Tenant]
     ↓
[Connect Scanner + Template]
     ↓
[Customize Branding]
     ↓
[Preview]
     ↓
[Go Live] ← One click, not two (publish + activate)
     ↓
[Collect Responses]
     ↓
[Manage: Disable / Archive / Restore]
```

---

## What Stays Hidden (Backend Safety)

Admins don't need to know about these, but they still work:

- **Immutable snapshots**: Each publish creates a frozen copy
- **Submission stability**: Responses always reference the survey version they were submitted against
- **Historical rollback**: Can switch between previously published versions (hidden feature for support)
- **Runtime config lineage**: Technical implementation not shown

---

## Why This Matters

### Reduces Cognitive Load

Admins shouldn't need to understand:
- Runtime configuration management
- Snapshot versioning
- Fingerprint matching
- Activation state machines

### Focuses on Business Value

Admins should focus on:
- What questions to ask
- How it should look
- When to go live
- How to collect responses

### Maintains Safety

The internal architecture still protects:
- Submission integrity
- Historical data stability
- Rollback capability
- Audit trails

But this protection is invisible - it just works.

---

## Design Principles

1. **One primary action**: "Go Live" instead of "Publish + Activate"
2. **Status = clear meaning**: Draft/Live/Disabled/Archived with explanations
3. **No technical jargon**: No runtimeConfigId, fingerprints, version IDs in UI
4. **Operations separated**: Dangerous actions in their own section
5. **Warnings visible but not blocking**: Guidance without preventing action

---

## Summary

The tenant module should feel like:

> **"I create a survey workspace, configure it, make it live, and manage it over time."**

Not:

> **"I deploy runtime configurations to a multi-tenant infrastructure with immutable snapshots."**

The first mental model is what we want admins to have. The second is what happens internally (and stays internal).