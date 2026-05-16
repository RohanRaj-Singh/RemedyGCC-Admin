# Scanner Versioning Audit

## Current Architecture Overview

### Scanner Model Structure

```
Scanner (root)
├── id, name, description, status
├── latestVersionNumber: number
├── draftVersionId: string | null
├── publishedVersionId: string | null
├── activeVersionId: string | null (runtime activation)
└── versions: ScannerVersion[]

ScannerVersion
├── id, scannerId, versionNumber
├── status: 'draft' | 'published' | 'archived'
├── isActive: boolean (runtime pointer)
├── sourceVersionId: string | null (lineage)
├── categories: Category[]
├── followUpTriggers: ScannerFollowUpTrigger[]
├── responseCount: number
├── publishedAt, archivedAt, createdAt, updatedAt
```

## Version Lifecycle

1. **Creation**: `createScanner()` → creates Scanner + initial draft version (v1)
2. **Editing**: `saveScannerDraft()` → updates existing draft version
3. **Publishing**: `publishScanner()` → converts draft to published, sets publishedVersionId
4. **New Version**: `createNewVersion()` → clones latest published to new draft (v2, v3, etc.)
5. **Activation**: `activateVersion()` → marks a published version as `isActive: true` for runtime
6. **Archiving**: `archiveVersion()` → marks non-active published versions as archived

## Required Version Boundaries

### Runtime Dependencies (MUST PRESERVE)

1. **Runtime Config Storage**
   - Stores `scannerVersionId` in `RuntimeVersionRefs`
   - Stores frozen `RuntimeScannerVersion` snapshot
   - Snapshot includes full categories, subdomains, questions, options, weights

2. **Submission References**
   - Submissions reference runtime config, not scanner directly
   - Dashboard queries submissions via runtime config
   - Historical data integrity depends on frozen snapshots

3. **Tenant Linking**
   - Tenant's `draftScannerId` references scanner root
   - Publishing resolves scanner content at publish time
   - Runtime config locks scanner version at publish moment

## Unnecessary Complexity Identified

### 1. Activation Switching
- **Current**: Multiple published versions can be activated/deactivated
- **Real Usage**: Tenants typically publish and activate once
- **Future Direction**: Likely unnecessary - duplication preferred over switching

### 2. Source Version Lineage (sourceVersionId)
- **Current**: Each version can reference its source
- **Real Usage**: Not displayed in UI, no practical benefit
- **Candidate for removal**: Historical reference that adds no value

### 3. Deep Version Trees
- **Current**: Unlimited version history
- **Real Usage**: Most scanners have 1-3 versions
- **Candidate for simplification**: Full history not required by business

### 4. Archive Version Feature
- **Current**: Can archive non-active versions
- **Real Usage**: Not exposed in UI, no use case
- **Candidate for removal**: Unused functionality

### 5. Version Status vs Scanner Status
- **Current**: Both Scanner and Version have status
- **Confusion**: Redundant state management
- **Simplification**: Version status should drive scanner status

## Current UX Issues

### 1. Draft Version Visibility
- Draft versions exist but are implicit
- User sees "Continue Editing Draft" or "Edit Scanner" based on state
- Version list shows drafts but initial focus is unclear

### 2. Version-First Assumption
- Edit flow assumes every change needs version management
- No distinction between minor edits and version-worthy changes
- Could simplify to: edit → save → (optional) publish

### 3. Version Number Display
- Shows v1, v2, v3 but doesn't explain what changed
- No change summary or notes
- Full version list visible but not actionable

## Future Simplification Strategy

### Phase 2+ Direction
- Reduce emphasis on version numbers
- Focus on "current working copy" vs "published snapshot"
- Duplication becomes primary reuse pattern
- Submission-aware edit protection instead of version locking

### Safe Changes (Future)
- Typo fixes in question text
- Reordering questions within subdomain
- Adding new questions (non-semantic)
- Updating descriptions

### Breaking Changes (Future)
- Changing answer scores
- Deleting questions with existing responses
- Modifying weights that affect calculated scores

## Current Safety Preservations

✅ Runtime configs store frozen snapshots  
✅ Tenant resolution uses published runtime config  
✅ Submissions reference immutable runtime config  
✅ Dashboard queries remain compatible  
✅ Mongo contracts preserved  

## Next Steps

1. Phase 1 (current): Stabilize and simplify visibility
2. Phase 2: Introduce change-impact model
3. Phase 3: Shift toward duplication workflow
4. Phase 4: Reduce version management complexity