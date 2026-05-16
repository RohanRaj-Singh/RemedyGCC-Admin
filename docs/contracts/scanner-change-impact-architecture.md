# Scanner Change Impact Architecture

## Overview

The Change Impact Classification System determines how scanner edits are classified based on their effect on runtime semantics, analytics, and submission integrity.

## Core Concepts

### Change Classification Levels

```
┌─────────────────────────────────────────────────────────┐
│                   CHANGE IMPACT SYSTEM                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SAFE (Non-Semantic)      ADDITIVE (Extension)         │
│  ─────────────────        ─────────────────────          │
│  • Typo fixes             • New questions              │
│  • Text changes           • New subdomains             │
│  • Order changes          • New categories (optional)   │
│  • Metadata updates       • New follow-ups              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         BREAKING (Semantic)                      │   │
│  │  ─────────────────────────────────────────────   │   │
│  │  • Score changes         • Deletions             │   │
│  │  • Weight changes       • Answer removal        │   │
│  │  • Semantic changes     • Structure changes     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Classification Rules

### Safe Changes

**Definition**: Changes that affect only presentation, not runtime semantics.

**Conditions**:
- No changes to numeric values (scores, weights)
- No structural deletions
- Only text/display modifications
- Only ordering changes

**Impact on Submissions**: None - historical data remains valid

**Impact on Dashboard**: None - calculations unaffected

**Example Detection**:
```typescript
// Question text change
if (beforeQ.text.en !== afterQ.text.en) {
  return { type: 'safe', severity: 'info', code: 'QUESTION_TEXT_CHANGED' };
}

// Order change
if (beforeQ.order !== afterQ.order) {
  return { type: 'safe', severity: 'info', code: 'QUESTION_ORDER_CHANGED' };
}
```

### Additive Changes

**Definition**: Changes that extend the scanner without invalidating historical data.

**Conditions**:
- New questions added (not replacing)
- New subdomains added
- New categories added (if structure allows)
- Optional follow-ups added

**Impact on Submissions**: None - old submissions remain valid, new submissions may have more data

**Impact on Dashboard**: None - existing calculations remain valid, new data extends analytics

**Example Detection**:
```typescript
// New question added
if (!beforeMap.has(id) && afterMap.has(id)) {
  return { type: 'additive', severity: 'info', code: 'QUESTION_ADDED' };
}

// New subdomain
if (!beforeMap.has(id) && afterMap.has(id)) {
  return { type: 'additive', severity: 'info', code: 'SUBDOMAIN_ADDED' };
}
```

### Breaking Changes

**Definition**: Changes that affect scoring semantics, analytics meaning, or invalidate historical data.

**Conditions**:
- Score value changes
- Answer option deletions
- Question/subdomain/category deletions
- Weight modifications
- Semantic answer changes

**Impact on Submissions**: Corrupts historical data integrity

**Impact on Dashboard**: Invalidates historical calculations

**Example Detection**:
```typescript
// Score change
if (beforeOpt.score !== afterOpt.score) {
  return { type: 'breaking', severity: 'blocking', code: 'SCORE_CHANGED' };
}

// Question deletion
if (!afterMap.has(id)) {
  return { type: 'breaking', severity: 'blocking', code: 'QUESTION_DELETED' };
}

// Weight change
if (beforeCat.weight !== afterCat.weight) {
  return { type: 'breaking', severity: 'blocking', code: 'CATEGORY_WEIGHT_CHANGED' };
}
```

## Submission-Aware Protection

### Protection Logic

```typescript
function checkSubmissionProtection(
  responseCount: number,
  impacts: ChangeImpact[]
): {
  protected: boolean;
  reason?: string;
  blockingImpacts: ChangeImpact[];
} {
  // No submissions = no protection needed
  if (responseCount === 0) {
    return { protected: false, blockingImpacts: [] };
  }

  // Check for breaking changes
  const breakingImpacts = impacts.filter(i => i.type === 'breaking');

  if (breakingImpacts.length > 0) {
    return {
      protected: true,
      reason: `This scanner has ${responseCount} submission(s). Breaking changes are not allowed.`,
      blockingImpacts: breakingImpacts,
    };
  }

  return { protected: false, blockingImpacts: [] };
}
```

### Protection Rules

| Scanner Has Responses | Change Type | Result |
|---------------------|-------------|--------|
| No | Breaking | Allowed |
| No | Additive | Allowed |
| No | Safe | Allowed |
| Yes | Breaking | **BLOCKED** |
| Yes | Additive | Allowed |
| Yes | Safe | Allowed |

## User Experience Flow

### Normal Edit Flow (No Submissions)

1. User edits scanner
2. Changes are classified
3. If breaking: warning shown but allowed (no data at risk)
4. User can save and publish

### Protected Edit Flow (Has Submissions)

1. User edits scanner
2. Changes are classified in real-time
3. If only safe/additive: normal save allowed
4. If breaking:
   - Save button shows error
   - Breaking Change Modal appears
   - User must either:
     - Cancel and revert changes
     - Click "Duplicate Scanner" to create new scanner

### Breaking Change Modal

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Breaking Changes Detected                          │
│                                                         │
│  This scanner already contains 15 submissions.         │
│  The following changes would affect data integrity:    │
│                                                         │
│  • Score changed for answer "Agree"                    │
│  • Question "Q3" has been deleted                      │
│                                                         │
│  Why this matters: Changing scores, deleting           │
│  questions, or modifying scoring behavior may corrupt  │
│  historical analytics consistency.                     │
│                                                         │
│  [Duplicate Scanner]  [Cancel]                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Scanner Form (Client-Side)

- Real-time change detection as user edits
- Shows ChangeImpactIndicator component
- Prevents save if breaking changes detected with submissions

### 2. Scanner Service (Server-Side)

- Validates changes before persisting
- Defense in depth - catches server-side attempts
- Returns clear error messages

### 3. Change Impact Engine (Shared)

- Pure function: `detectScannerChanges(before, after)`
- No side effects
- Deterministic classification
- Used by both client and server

## Runtime Safety Guarantees

### What Is Preserved

✅ Old submissions remain valid  
✅ Dashboard calculations stable  
✅ Runtime payloads compatible  
✅ Aggregation logic unaffected  

### What Can Change

- New questions added (additive)
- New subdomains added (additive)  
- Text corrections (safe)
- Order changes (safe)
- Metadata updates (safe)

### What Is Blocked

- Score modifications (breaking)
- Question deletions (breaking)
- Weight changes (breaking)
- Answer removals (breaking)

## Duplication Workflow

When breaking changes are needed on a scanner with submissions:

```
Scanner A (15 submissions)
      │
      ▼ [User clicks "Duplicate Scanner"]
      │
      ▼
Scanner B (new, 0 submissions)
      │
      ▼ [User makes breaking changes]
      │
      ▼ [User publishes Scanner B]
      │
Scanner B (published, can be activated)
```

This approach:
- Preserves Scanner A's historical data
- Allows full structural changes on Scanner B
- Maintains clean separation of concerns

## Future Enhancements

### Phase 3: Enhanced Change Detection
- Semantic answer analysis
- Weight impact calculation
- Cascade effect detection

### Phase 4: Change Approval Workflow
- Request approval for breaking changes
- Audit trail for changes
- Rollback capabilities