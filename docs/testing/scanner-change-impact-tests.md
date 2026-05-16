# Scanner Change Impact Tests

## Overview

Tests for the scanner change impact classification system that determines safe vs breaking changes.

## Change Types

### Safe Changes (Non-Semantic)

```typescript
// These changes should be allowed even with existing submissions
- Question text corrections (typos)
- Question order changes within subdomain
- Subdomain order changes within category
- Category order changes
- Metadata updates (descriptions, help text)
```

**Test:**
```typescript
const before = createScannerWithQuestions([...]);
const after = modifyQuestionText(before, 'Corrected typo');

const result = detectScannerChanges(before, after);

expect(result.canSave).toBe(true);
expect(result.impacts.every(i => i.type === 'safe')).toBe(true);
```

### Additive Changes

```typescript
// These extend the scanner without invalidating old submissions
- Adding new questions
- Adding new subdomains
- Adding new categories (if optional)
- Adding optional follow-ups
```

**Test:**
```typescript
const before = createScannerWithQuestions([...]);
const after = addNewQuestion(before, 'New question');

const result = detectScannerChanges(before, after);

expect(result.canSave).toBe(true);
expect(result.impacts.some(i => i.type === 'additive')).toBe(true);
```

### Breaking Changes (Semantic)

```typescript
// These affect scoring/analytics and are blocked when submissions exist
- Changing answer scores
- Deleting questions
- Deleting subdomains
- Deleting categories
- Changing answer options
- Changing weights
```

**Test:**
```typescript
const before = createScannerWithQuestions([...]);
const after = changeAnswerScore(before, 5, 10);

const result = detectScannerChanges(before, after);

expect(result.canSave).toBe(false);
expect(result.requiresDuplicate).toBe(true);
expect(result.impacts.some(i => i.type === 'breaking')).toBe(true);
```

## Submission-Aware Blocking Tests

### Test: Breaking Changes Blocked When Submissions Exist

```typescript
const scanner = await createScannerWithSubmissions(5);
const breakingChange = makeBreakingChange(scanner);

const result = detectScannerChanges(scanner.draftVersion, breakingChange);
const protection = checkSubmissionProtection(5, result.impacts);

expect(protection.protected).toBe(true);
expect(protection.blockingImpacts.length).toBeGreaterThan(0);
```

### Test: Safe Changes Allowed When Submissions Exist

```typescript
const scanner = await createScannerWithSubmissions(10);
const safeChange = makeSafeChange(scanner);

const result = detectScannerChanges(scanner.draftVersion, safeChange);
const protection = checkSubmissionProtection(10, result.impacts);

expect(protection.protected).toBe(false);
expect(result.canSave).toBe(true);
```

### Test: Additive Changes Allowed When Submissions Exist

```typescript
const scanner = await createScannerWithSubmissions(10);
const additiveChange = addNewQuestion(scanner);

const result = detectScannerChanges(scanner.draftVersion, additiveChange);
const protection = checkSubmissionProtection(10, result.impacts);

expect(protection.protected).toBe(false);
expect(result.canSave).toBe(true);
```

### Test: No Submissions = All Changes Allowed

```typescript
const scanner = await createScannerWithNoSubmissions();
const breakingChange = makeBreakingChange(scanner);

const result = detectScannerChanges(scanner.draftVersion, breakingChange);
const protection = checkSubmissionProtection(0, result.impacts);

expect(protection.protected).toBe(false);
expect(result.canSave).toBe(true);
```

## Metadata Edit Tests

### Test: Question Text Changes Are Safe

```typescript
const scanner = await createScannerWithSubmissions(5);
const change = { ...scanner.draftVersion, categories: [{
  ...scanner.draftVersion.categories[0],
  subdomains: [{
    ...scanner.draftVersion.categories[0].subdomains[0],
    questions: [{
      ...scanner.draftVersion.categories[0].subdomains[0].questions[0],
      text: { en: 'Fixed typo in question', ar: '...' }
    }]
  }]
}]};

const result = detectScannerChanges(scanner.draftVersion, change as ScannerVersion);

expect(result.impacts.every(i => i.type === 'safe' || i.type === 'additive')).toBe(true);
```

### Test: Question Order Changes Are Safe

```typescript
const scanner = await createScannerWithSubmissions(5);
const question1 = scanner.draftVersion.categories[0].subdomains[0].questions[0];
const question2 = scanner.draftVersion.categories[0].subdomains[0].questions[1];

// Swap order
const change = { ...scanner.draftVersion, categories: [{
  ...scanner.draftVersion.categories[0],
  subdomains: [{
    ...scanner.draftVersion.categories[0].subdomains[0],
    questions: [question2, question1]
  }]
}]};

const result = detectScannerChanges(scanner.draftVersion, change as ScannerVersion);

expect(result.impacts.some(i => i.code === 'QUESTION_ORDER_CHANGED')).toBe(true);
expect(result.canSave).toBe(true);
```

## Dashboard Compatibility Tests

### Test: Additive Changes Don't Break Dashboard

```typescript
const scanner = await createScannerWithSubmissions(100);
const additiveChange = addNewQuestion(scanner);

// Simulate old submissions
const oldSubmissions = generateSubmissions(100, scanner.draftVersion);

// Simulate new submissions with additional data
const newSubmissions = generateSubmissions(10, additiveChange);

// Dashboard calculations should work for both
const oldResults = calculateDashboard(oldSubmissions);
const newResults = calculateDashboard([...oldSubmissions, ...newSubmissions]);

expect(oldResults.total).toBe(100);
expect(newResults.total).toBe(110);
```

## Duplicate Scanner Flow Tests

### Test: Breaking Changes Suggest Duplication

```typescript
const scanner = await createScannerWithSubmissions(5);
const breakingChange = makeBreakingChange(scanner);

const result = detectScannerChanges(scanner.draftVersion, breakingChange);

expect(result.requiresDuplicate).toBe(true);
expect(result.canSave).toBe(false);

// Modal should guide user to duplicate
const modal = render(<BreakingChangeModal responseCount={5} ... />);
expect(modal.getByText('Duplicate Scanner')).toBeInTheDocument();
```