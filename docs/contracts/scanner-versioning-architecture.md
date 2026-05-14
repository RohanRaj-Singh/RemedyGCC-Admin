# Scanner Versioning Architecture

## Overview

Scanner versioning in RemedyGCC provides immutable version control for scanner definitions, enabling safe editing, publishing, and lifecycle management without affecting live runtime configurations.

## Core Concepts

### Scanner Root

A scanner is the top-level container that owns multiple versions:

```text
Scanner (root)
├── v1 (draft/published/archived)
├── v2 (draft/published/archived)
└── v3 (draft/published/archived)
```

The scanner root contains:
- `id`: Unique identifier
- `name`: Localized display name
- `description`: Optional localized description
- `status`: Current operational status (draft/published/archived)
- `latestVersionNumber`: Highest version number
- `activeVersionId`: Currently active published version
- `versionStats`: Count of versions by status

### Scanner Version

Each version represents a complete, self-contained scanner definition:

```typescript
interface ScannerVersion {
  id: string;
  scannerId: string;
  versionNumber: number;
  status: 'draft' | 'published' | 'archived';
  isActive: boolean;
  sourceVersionId: string | null;
  categories: Category[];
  followUpTriggers: ScannerFollowUpTrigger[];
  responseCount: number;
  publishedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Version States

### Draft
- Editable working version
- Can be saved multiple times
- Only one draft per scanner at a time
- Can be published when valid

### Published
- Immutable snapshot
- Can be used in runtime configurations
- Can be activated (made the active version)
- Can be archived

### Active
- Sub-state of published
- Currently referenced by runtime
- Cannot be archived without replacement
- Displayed prominently in UI

### Archived
- Historical version, no longer editable
- Preserved for audit/reference
- Cannot be activated

## Version Lifecycle

### Creating a New Scanner

1. User creates new scanner
2. System creates scanner root with v1 in draft status
3. User edits draft, saves changes
4. User publishes when ready

### Editing a Published Scanner

1. User clicks "Create New Version" or "Edit"
2. System clones latest published version content
3. Creates new draft version (v2, v3, etc.)
4. User edits draft content
5. User publishes when ready

### Publishing Flow

```
Draft Version
→ Validate (check scanner structure)
→ Publish (change status to 'published')
→ Optionally Activate (set isActive = true)
```

### Safe Edit Flow

Published/active versions are NEVER edited directly. Instead:
1. Create new draft from latest published
2. Edit draft content
3. Publish new version
4. Optionally activate

This preserves historical integrity and prevents runtime corruption.

## Version Lineage

Each version tracks its source via `sourceVersionId`:

```text
v1 (published) ← v2 (draft) ← v3 (draft)
     ↑
sourceVersionId points to parent
```

This enables understanding the evolution of scanner definitions.

## Version Reuse Optimization

When creating new drafts, the system clones from the latest published version to preserve all content (categories, questions, follow-ups, weights).

## Safe Deletion

Versions cannot be deleted if:
- They are active (have active runtime references)
- They have responses submitted against them

Versions can be archived instead, preserving history while marking as inactive.

## API Surface

### Create Scanner
```typescript
createScanner(data: CreateScannerDto): Promise<ScannerDetail>
```

### Save Draft
```typescript
saveScannerDraft(scannerId: string, data: SaveScannerDraftDto): Promise<ScannerDetail>
```

### Publish Version
```typescript
publishScanner(scannerId: string): Promise<ScannerDetail>
```

### Create New Version
```typescript
createNewVersion(scannerId: string): Promise<ScannerDetail>
```

### Duplicate Scanner (Replicate)
```typescript
duplicateScanner(data: DuplicateScannerDto): Promise<ScannerDetail>
```

### Archive Version
```typescript
archiveVersion(scannerId: string, versionId: string): Promise<ScannerDetail>
```

### Activate Version
```typescript
activateVersion(scannerId: string, versionId: string): Promise<ScannerDetail>
```

## UI Display

### Scanner List
Shows for each scanner:
- Name and description
- Version stats (total/draft/published/archived)
- Question count
- Status badge
- Last published date
- Actions (View, Edit)

### Scanner Detail
Shows:
- Active version indicator
- Version history with status badges
- Published date, archived date
- Response counts per version

### Scanner Editor
Shows:
- Version number being edited
- Unsaved changes protection
- Publish/Activate actions
- Create new version button

## Runtime Compatibility

Published scanner versions are frozen at publish time. Runtime configurations reference specific version IDs. This ensures:

1. Historical submissions remain valid
2. Dashboard metrics don't change unexpectedly
3. Runtime behavior is predictable

When a version is archived:
- Existing runtime configs still work
- New configs can't reference archived versions
- Historical data preserved