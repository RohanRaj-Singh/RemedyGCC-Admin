# Scanner Editing Lifecycle

## Overview

This document describes the new canonical editing behavior for scanners based on submission state.

## Lifecycle States

### State 1: No Submissions

**Condition**: Scanner has 0 submissions

**Behavior**: 
- Full editing allowed
- No change impact restrictions
- All changes persisted normally
- Can publish at any time

**Flow**:
```
Create Scanner → Edit (any changes) → Publish → Active
```

### State 2: Has Submissions (Protected)

**Condition**: Scanner has 1+ submissions

**Behavior**:
- Safe changes allowed (typos, text, order)
- Additive changes allowed (new questions, subdomains)
- Breaking changes BLOCKED
- Must use Duplicate Scanner for structural changes

**Flow**:
```
Published Scanner with Submissions
         │
         ▼
   User edits scanner
         │
         ▼
  Change Impact Check
         │
    ┌────┴────┐
    │         │
 Safe/    Breaking
Additive   Changes
    │         │
    ▼         ▼
Allow    Show Modal
    │         │
    ▼    [Duplicate]
    │    Scanner
    ▼         │
Save     New Scanner
    │         │
    ▼         ▼
Publish  Edit Freely
```

## Change Type Decision Tree

```
Start: User saves scanner edits
         │
         ▼
   Has submissions?
    │    │
    No   Yes
    │    │
    ▼    ▼
ALLOW  Check change type
       │
  ┌────┼────┐
  │    │    │
Safe   Add   Break
  │    │    │
  ▼    ▼    ▼
ALLOW ALLOW BLOCK
              │
              ▼
        Show Modal
        [Duplicate]
```

## Detailed State Transitions

### Transition 1: Free Edit → Publish

**From**: Scanner with no submissions  
**Action**: Edit any content  
**Result**: Allowed immediately  

```typescript
// Example: No submissions
const scanner = await getScanner('scanner-1');
// scanner.hasResponses = false

// User makes any changes
const changes = makeAnyChanges(scanner.draftVersion);

// Save succeeds
await saveScannerDraft('scanner-1', changes);
// ✓ Success
```

### Transition 2: Safe Edit with Submissions

**From**: Scanner with 10 submissions  
**Action**: Fix typo in question text  
**Result**: Allowed immediately  

```typescript
// Example: Has submissions
const scanner = await getScanner('scanner-1');
// scanner.hasResponses = true (10 submissions)

// User fixes typo
const safeChange = { 
  ...scanner.draftVersion,
  categories: [{
    ...scanner.draftVersion.categories[0],
    subdomains: [{
      ...scanner.draftVersion.categories[0].subdomains[0],
      questions: [{
        ...scanner.draftVersion.categories[0].subdomains[0].questions[0],
        text: { en: 'Fixed typo', ar: '' }
      }]
    }]
  }]
};

const result = detectScannerChanges(scanner.draftVersion, safeChange);
// result.canSave = true

await saveScannerDraft('scanner-1', safeChange);
// ✓ Success
```

### Transition 3: Additive Edit with Submissions

**From**: Scanner with 10 submissions  
**Action**: Add new question  
**Result**: Allowed immediately  

```typescript
// Example: Add new question
const scanner = await getScanner('scanner-1');
// scanner.hasResponses = true

// User adds question
const additiveChange = addQuestion(scanner.draftVersion, newQuestion);

const result = detectScannerChanges(scanner.draftVersion, additiveChange);
// result.canSave = true

await saveScannerDraft('scanner-1', additiveChange);
// ✓ Success
```

### Transition 4: Breaking Edit Attempt

**From**: Scanner with 10 submissions  
**Action**: Change answer score  
**Result**: BLOCKED  

```typescript
// Example: Change score
const scanner = await getScanner('scanner-1');
// scanner.hasResponses = true

// User changes score
const breakingChange = changeScore(scanner.draftVersion, 'q1', 'a1', 10);

const result = detectScannerChanges(scanner.draftVersion, breakingChange);
// result.canSave = false
// result.requiresDuplicate = true

try {
  await saveScannerDraft('scanner-1', breakingChange);
  // ✗ Error: Breaking changes not allowed with existing submissions
} catch (error) {
  // Show BreakingChangeModal
  // Options: Cancel | Duplicate Scanner
}
```

### Transition 5: Duplicate Scanner Flow

**From**: Scanner with breaking changes needed  
**Action**: Click "Duplicate Scanner"  
**Result**: New scanner created  

```typescript
// User clicks "Duplicate Scanner"
const duplicated = await duplicateScanner({
  sourceScannerId: 'scanner-1',
  newName: { en: 'Scanner 1 (Copy)', ar: '' },
});

// New scanner has 0 submissions
// Can make any changes freely

const breakingChange = makeBreakingChanges(duplicated.draftVersion);
await saveScannerDraft(duplicated.id, breakingChange);
// ✓ Success - new scanner, no submissions

await publishScanner(duplicated.id);
// ✓ Published
```

## Edit Type Summary Table

| Edit Type | No Submissions | Has Submissions |
|-----------|----------------|-----------------|
| Fix typo | ✅ Allowed | ✅ Allowed |
| Reorder questions | ✅ Allowed | ✅ Allowed |
| Add question | ✅ Allowed | ✅ Allowed |
| Add subdomain | ✅ Allowed | ✅ Allowed |
| Change score | ✅ Allowed | ❌ BLOCKED |
| Delete question | ✅ Allowed | ❌ BLOCKED |
| Change weight | ✅ Allowed | ❌ BLOCKED |
| Remove answer | ✅ Allowed | ❌ BLOCKED |

## UI UX Guidelines

### 1. Editor Header

Show current protection status:
```
Status: Protected (15 submissions)
```

### 2. Change Impact Indicator

Display real-time feedback:
```
Changes detected: 1 safe, 0 additive, 0 breaking
```

### 3. Save Button

Show appropriate state:
- Normal: "Save Draft"
- Has blocking: "Save Draft" (disabled with tooltip)
- Saving: "Saving..."

### 4. Breaking Change Modal

When blocking detected:
```
Title: Breaking Changes Detected
Body: Explains why blocked + what's affected
Actions: [Duplicate Scanner] [Cancel]
```

## Implementation Notes

### Client-Side Detection
- Run change detection on every edit
- Update UI indicators in real-time
- Provide immediate feedback

### Server-Side Validation
- Always validate before saving
- Defense in depth approach
- Return clear error messages

### Mongo Persistence
- Scanner document stores versions as array
- Each version has status: draft | published | archived
- No additional schema changes needed

## Migration Path

For existing scanners:
- All scanners with 0 submissions: No change (free editing)
- All scanners with submissions: Immediately protected

For new scanners:
- Starts with 0 submissions
- Becomes protected once first submission recorded

## Future Considerations

### Potential Enhancement: Selective Blocking
- Block only questions with responses
- Allow editing questions without responses

### Potential Enhancement: Approval Workflow
- Allow breaking changes with approval
- Audit trail for approved changes

### Potential Enhancement: Version Branching
- Create branch instead of full duplicate
- Merge back after review