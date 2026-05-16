# Duplicate Scanner Architecture

## Overview

The Duplicate Scanner feature creates independent copies of scanners for major revisions, client customizations, and annual survey refreshes. This is the PRIMARY scanner evolution strategy, replacing heavy immutable version lineage.

## Key Philosophy

### Why Duplication Over Versioning?

| Versioning Approach | Duplication Approach |
|-------------------|---------------------|
| Deep version trees | Independent copies |
| Branch/merge complexity | Simple copy workflow |
| Runtime activation switching | Fresh independent scanner |
| Shared mutable history | Isolated lifecycle |
| Complex rollback scenarios | Delete original if unwanted |

### Platform Context

The platform is **tenant-centric**, NOT a shared scanner ecosystem. This means:
- Scanners are rarely shared between tenants
- Major changes happen per-tenant
- Duplication provides cleaner mental model
- Independent lifecycle is often preferred

## Architecture

### Scanner Document Structure

```
Scanner (root)
├── id: string (NEW unique ID)
├── name: LocalizedText
├── description?: LocalizedText
├── status: 'draft' | 'published' | 'archived'
├── duplicatedFromScannerId?: string (source traceability)
├── versions: ScannerVersion[]
└── ... other metadata
```

### What Gets Copied

✅ **Full Structure**
- Categories (5 fixed categories)
- Subdomains within categories
- Questions within subdomains
- Answer options within questions
- Weights at all levels
- Follow-up triggers

✅ **Metadata**
- Scanner description
- Version stats (reset to initial)
- Category/subdomain/question counts

✅ **Source Traceability**
- `duplicatedFromScannerId` for audit/visibility

❌ **What Does NOT Copy**
- Submission history
- Runtime configurations
- Dashboard data
- Response counts (resets to 0)
- `publishedVersionId`, `activeVersionId` (resets)

### What Gets Fresh

```typescript
const duplicatedScanner = {
  id: createId('scanner'),          // NEW ID
  status: 'draft',                   // Always draft
  draftVersionId: null,              // Will be set
  publishedVersionId: null,
  activeVersionId: null,
  hasResponses: false,
  hasUnpublishedChanges: true,
  versionStats: { total: 1, draft: 1, published: 0, archived: 0 },
  lastPublishedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  duplicatedFromScannerId: sourceId, // Source reference
};
```

## Runtime Isolation

### How Isolation Works

```
Original Scanner                    Duplicated Scanner
───────────────                     ─────────────────
Published Runtime Config 1    →      No Runtime Config yet
    │                                    │
    ↓                                    ↓
Submissions: 15                    Submissions: 0
    │                                    │
    ↓                                    ↓
Dashboard (15 subs)                Dashboard (empty)

When Duplicated publishes:
    │
    ↓
New Runtime Config 2 (independent)
    │
    ↓
New Submissions: isolated
```

### Key Isolation Points

1. **Runtime Configs**: Each scanner has its own runtime config when published
2. **Submissions**: Reference `runtimeConfigId`, not scanner directly
3. **Dashboard**: Aggregates by `runtimeConfigId`
4. **No Cross-Reference**: Runtime config stores frozen scanner snapshot

## Source Traceability

### Why Store Source Reference?

- **Audit visibility**: Track where scanners originate
- **Admin clarity**: Understand scanner genealogy
- **Migration tooling**: Future tools may need to trace origins
- **Not runtime dependency**: Just informational

### Implementation

```typescript
interface Scanner {
  // ... other fields
  duplicatedFromScannerId?: string | null;
}
```

The `duplicatedFromScannerId` field:
- Is optional (original scanners don't have it)
- Stores source scanner ID at duplication time
- Does NOT create runtime dependency
- Does NOT affect publish/save behavior
- Does NOT appear in UI by default (could be shown in admin views)

## Duplication Flow

### Step-by-Step

```
1. User clicks "Duplicate Scanner"
         │
         ↓
2. Modal opens with pre-filled name: "[Original Name] (Copy)"
         │
         ↓
3. User optionally changes name/description
         │
         ↓
4. User clicks "Duplicate Scanner"
         │
         ↓
5. System:
   a. Validates source scanner exists
   b. Creates NEW scanner ID
   c. Copies structure with NEW IDs
   d. Sets duplicatedFromScannerId
   e. Resets all state fields
         │
         ↓
6. User redirected to edit page of NEW scanner
         │
         ↓
7. NEW scanner is independent - any edits allowed
```

## Integration Points

### 1. Scanner List Page
- "Duplicate" button in action column
- Opens DuplicateScannerModal
- Refreshes list after duplication

### 2. Scanner Detail Page
- "Duplicate" action in toolbar
- Same flow as list page

### 3. Breaking Change Modal
- When breaking changes detected with submissions
- Shows inline name input
- Direct "Duplicate Scanner" action

### 4. Scanner Editor (ScannerForm)
- handleDuplicateScanner() function
- Navigates to new scanner's edit page

## UI Components

### DuplicateScannerModal

```tsx
interface DuplicateScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDuplicate: (name: LocalizedText, description?: LocalizedText) => Promise<void>;
  sourceScannerName: string;
  sourceScannerId: string;
}
```

**Features**:
- Pre-fills name with "(Copy)" suffix
- Shows source scanner info
- Explains isolation benefits
- Loading state during duplication

### BreakingChangeModal (Enhanced)

Now includes:
- Name input for duplicated scanner
- Direct duplication action
- Cancel option

## Dashboard Isolation

### How Dashboards Stay Separate

```typescript
// Dashboard query
async function getDashboard(runtimeConfigId: string) {
  const submissions = await db.submissions.find({
    runtimeConfigId: runtimeConfigId
  });
  // Aggregate from these submissions only
  return aggregate(submissions);
}
```

**Key**: Dashboard is NOT keyed by scanner ID, but by runtime config ID. Each published version creates a new runtime config, ensuring isolation.

## Future Considerations

### Potential Enhancements

1. **Version Diff View**: Show changes between original and duplicated
2. **Bulk Duplication**: Duplicate multiple scanners at once
3. **Template Libraries**: Mark scanners as templates for duplication
4. **Duplication History**: Track all duplications from a scanner

### Migration Scenarios

**Annual Survey Refresh**:
```
Employee Wellness 2026
      ↓ [Duplicate]
Employee Wellness 2027 (editable draft)
      ↓ [Customize for 2027]
      ↓ [Publish]
Employee Wellness 2027 (live)
```

**Client Customization**:
```
Generic Healthcare Scanner
      ↓ [Duplicate]
Healthcare Client A Scanner
      ↓ [Client-specific edits]
      ↓ [Publish]
Healthcare Client A (live)
```

## Comparison: Duplicate vs Version

| Aspect | Duplicate Scanner | Version Branching |
|--------|------------------|-------------------|
| Identity | New independent scanner | Same scanner, new version |
| Submissions | Completely isolated | Shared history |
| Dashboard | Independent | Either merged or versioned |
| Lifecycle | Fresh draft → publish → active | New version, publish → activate |
| Rollback | Delete new, keep original | Revert to old version |
| Mental Model | "Copy this survey" | "Create version 2" |
| Use Case | Major redesign | Minor iterative changes |

## Security Considerations

1. **No Permission Escalation**: User can only duplicate scanners they have access to
2. **Audit Trail**: Source reference stored for compliance
3. **No Data Leakage**: Submissions never copied
4. **Access Control**: Duplicated scanner inherits creator's permissions

## Performance Considerations

1. **Deep Copy**: All questions/options must be cloned
2. **ID Generation**: New IDs for all entities
3. **Mongo Write**: Single insert for scanner + version
4. **No Cascade**: No need to check related entities (submissions aren't copied)

## Conclusion

Duplicate Scanner becomes the **primary evolution strategy** for major changes:

- **Minor edits**: Direct editing (safe/additive changes)
- **Major redesign**: Duplicate Scanner workflow
- **Breaking changes with submissions**: Duplicate Scanner required

This approach provides clear separation, prevents analytics corruption, and gives administrators confidence that historical data remains intact.