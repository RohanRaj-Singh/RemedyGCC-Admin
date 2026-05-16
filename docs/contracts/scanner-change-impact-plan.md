# Scanner Change Impact Plan

## Purpose

This document outlines the future architecture direction for scanner changes, distinguishing between:
- **Safe changes**: Non-breaking edits that don't affect existing submissions
- **Breaking changes**: Semantic changes that invalidate historical data

## Why Full Versioning Is Being Reduced

### Business Context
- Platform is tenant-specific survey management, NOT reusable survey ecosystem
- Scanners are rarely shared between tenants
- Dashboard focuses on calculations/charts from submissions
- Clients do NOT require deep historical scanner lineage

### Technical Realization
- Runtime uses frozen snapshots, not live scanner references
- Submissions reference immutable runtime configs
- Deep version trees add complexity without business value

### Future Direction
- Submission-aware edit protection (block edits if responses exist)
- Scanner duplication for reuse (copy entire scanner)
- Reduced emphasis on version branching

## Safe Changes (Non-Breaking)

These changes can be made without affecting existing submissions:

### 1. Text Corrections
- Fixing typos in question text
- Updating descriptions
- Correcting category/subdomain names

### 2. Question Reordering
- Moving questions within a subdomain
- Changing order of subdomains within category

### 3. Additive Changes
- Adding new questions (non-semantic addition)
- Adding new options to existing questions
- Adding new subdomains to categories

### 4. Non-Semantic Metadata
- Updating scanner name/description
- Adjusting weights that don't affect existing score calculations
  - **Exception**: If responses already exist with specific weight calculations

### 5. Follow-up Trigger Updates
- Adding new follow-up triggers
- Modifying trigger conditions (if no responses)

## Breaking Changes (Require Protection)

These changes affect existing submission data:

### 1. Score Modifications
- Changing answer option scores
- Adding/removing answer options
- Modifying question weights

### 2. Question Deletion
- Removing questions that have been answered
- Deleting subdomains with existing responses

### 3. Semantic Answer Changes
- Changing answer option labels in ways that affect interpretation
- Modifying answer types (e.g., from single-select to multi-select)

### 4. Category Structure Changes
- Removing categories
- Moving subdomains between categories
- Changing category weights after responses exist

## Change Detection Strategy (Future)

```typescript
interface ChangeImpact {
  type: 'safe' | 'breaking' | 'requires_review';
  reason: string;
  blocking: boolean;
  affectedResponses: number;
}

function assessChangeImpact(
  before: ScannerVersion,
  after: ScannerVersion
): ChangeImpact {
  const impacts: ChangeImpact[] = [];

  // Check for score changes
  if (hasScoreChanges(before, after)) {
    return { type: 'breaking', reason: 'Score values changed', ... };
  }

  // Check for deleted questions
  if (hasDeletedQuestions(before, after)) {
    return { type: 'breaking', reason: 'Questions were deleted', ... };
  }

  // Check for additive-only changes
  if (isAdditiveOnly(before, after)) {
    return { type: 'safe', reason: 'Only additive changes detected', ... };
  }

  return { type: 'requires_review', ... };
}
```

## Future Protection Flow (Phase 2+)

```
1. User attempts to save scanner changes
2. System compares current version with saved version
3. If hasResponses > 0:
   a. Run change impact assessment
   b. If breaking: BLOCK with explanation
   c. If safe: ALLOW with confirmation
4. If hasResponses = 0: ALLOW (no historical data at risk)
```

## Duplication Over Versioning

Instead of creating new versions, users will duplicate scanners:

```
Current Flow: Scanner v1 → edit → publish → Scanner v2 (version chain)

Future Flow: Scanner A (published) → duplicate → Scanner B (new, independent)
```

### Benefits of Duplication
- Complete isolation - no shared lineage complexity
- Clear ownership - each tenant owns their scanner
- Simple mental model - "copy this scanner" not "branch version"
- No version archaeology - just working copies and snapshots

## Current Phase 1 Preparation

In this phase, we are NOT implementing full change detection. We're only:
1. Documenting the architecture
2. Preserving runtime safety
3. Reducing unnecessary UX complexity
4. Preparing structures for future change-impact hooks

## Future Implementation Order

1. **Phase 1** (current): Audit and stabilize
2. **Phase 2**: Add change impact detection framework
3. **Phase 3**: Implement submission-aware protection
4. **Phase 4**: Simplify version UX, emphasize duplication
5. **Phase 5**: Reduce version complexity (sourceVersionId removal, etc.)