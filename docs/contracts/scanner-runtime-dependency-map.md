# Scanner Runtime Dependency Map

## Overview

This document maps EXACT runtime dependencies on scanner version references. Critical for future simplification phases.

## Dependency Chain

```
Tenant
  └── draftScannerId → Scanner (root ID only)
                      └── Published Runtime Config
                          └── scannerVersionId → RuntimeScannerVersion (frozen)
                          └── sourceScannerVersionId → ScannerVersion (source reference)

Runtime Config (at publish time)
  ├── scannerVersionId: string (reference)
  ├── version: string (display number)
  └── frozenScannerSnapshot: RuntimeScannerVersion (immutable copy)

RuntimeScannerVersion
  ├── id: scannerVersionId
  ├── version: string
  ├── categories: Category[] (deep copy)
  ├── subdomains: Subdomain[] (deep copy)
  ├── questions: Question[] (deep copy)
  └── followUpTriggers: ScannerFollowUpTrigger[] (deep copy)

Submissions
  └── runtimeConfigId → RuntimeConfig (immutable)
                        └── scannerVersionId (frozen reference)

Dashboard Queries
  └── Filter by runtimeConfigId
      └── Scanner version is indirect via config
```

## What Requires Preservation

### 1. Frozen Scanner Snapshots
- At publish time, entire scanner content is copied into runtime config
- This snapshot is immutable - even if scanner is edited later
- **DO NOT CHANGE**: Historical submissions depend on this

### 2. Runtime Config Scanner References
- `RuntimeVersionRefs.scannerVersionId`
- `RuntimeVersionRefs.sourceScannerVersionId`
- Used for display and audit purposes
- **DO NOT CHANGE**: Dashboard and analytics depend on this

### 3. Tenant-Scanner Link
- Tenant stores `draftScannerId` (root reference)
- NOT a version reference - always points to scanner root
- **CAN SIMPLIFY**: This is already version-agnostic

## What Can Change

### 1. Version Status Fields
- `isActive` - runtime activation flag
- `status` (draft/published/archived) - management only
- These are NOT copied to runtime config

### 2. Version Metadata
- `sourceVersionId` - lineage tracking (unused)
- Version numbers - display only
- Archive state - management only

### 3. Scanner Root Fields
- `draftVersionId`, `publishedVersionId`, `activeVersionId`
- These are runtime-agnostic pointers

## Current Runtime Flow

```
1. User edits scanner (draft version)
2. User clicks "Publish"
3. Publishing engine:
   a. Validates draft content
   b. Creates RuntimeScannerVersion (deep copy of draft)
   c. Stores in RuntimeConfig with scannerVersionId
   d. Tenant.activeRuntimeConfigId points to this config

4. Respondents access survey
   a. Middleware resolves tenant → active runtime config
   b. Uses frozen scanner snapshot (NOT live scanner)
   c. Submissions stored with runtimeConfigId reference

5. Dashboard queries
   a. Query submissions by runtimeConfigId
   b. Scanner version is implicit in config snapshot
```

## Key Insight

**The runtime does NOT reference live scanner versions.** It references frozen snapshots stored in runtime configs. This means:

- Scanner version management changes WON'T break runtime
- Only publish safety matters (snapshot creation)
- Deep version history is NOT required for runtime
- Duplication can replace versioning for reuse

## Future Simplification Path

1. **Keep**: Runtime config frozen snapshots
2. **Keep**: Tenant → scanner root link (not version)
3. **Reduce**: Version activation switching
4. **Reduce**: Version lineage tracking (sourceVersionId)
5. **Shift**: Toward duplication for reuse, not version branching