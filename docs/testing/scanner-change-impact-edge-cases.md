# Scanner Change Impact Edge Cases

## Deletion Edge Cases

### Edge Case 1: Deleting Questions with Responses

**Scenario**: Delete a question that has existing response data

**Expected**: BLOCKED with clear error message

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
// Question q1 has 10 responses
const change = removeQuestion(scanner.draftVersion, 'q1');

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.impacts).toContainEqual(
  expect.objectContaining({ code: 'QUESTION_DELETED', type: 'breaking' })
);
```

### Edge Case 2: Deleting Subdomain with Questions

**Scenario**: Delete a subdomain containing questions

**Expected**: BLOCKED - all questions in subdomain are affected

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
// Subdomain s1 has 3 questions with responses
const change = removeSubdomain(scanner.draftVersion, 's1');

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.impacts).toContainEqual(
  expect.objectContaining({ 
    code: 'SUBDOMAIN_DELETED', 
    type: 'breaking',
    affectedCount: 3 
  })
);
```

### Edge Case 3: Deleting Empty Subdomain

**Scenario**: Delete a subdomain with no questions and no responses

**Expected**: ALLOWED (additive - no data loss)

**Test**:
```typescript
const scanner = createScannerWithEmptySubdomain();
const change = removeSubdomain(scanner.draftVersion, 'empty-subdomain');

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.canSave).toBe(true);
```

## Score Mutation Edge Cases

### Edge Case 4: Changing Single Answer Score

**Scenario**: Change score for one answer option from 5 to 10

**Expected**: BLOCKED

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(5);
const change = modifyAnswerScore(scanner.draftVersion, 'q1', 'a1', 10);

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.impacts).toContainEqual(
  expect.objectContaining({ code: 'SCORE_CHANGED', type: 'breaking' })
);
```

### Edge Case 5: Reordering Answer Options (No Score Change)

**Scenario**: Change the display order of answer options without changing scores

**Expected**: ALLOWED (safe - no semantic change)

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(5);
const change = reorderAnswers(scanner.draftVersion, 'q1', ['a3', 'a1', 'a2']);

const result = detectScannerChanges(scanner.draftVersion, change);
// Should detect order change as safe
expect(result.impacts.some(i => i.code === 'QUESTION_ORDER_CHANGED')).toBe(true);
expect(result.canSave).toBe(true);
```

### Edge Case 6: Adding New Answer Options

**Scenario**: Add new answer options to existing question

**Expected**: ALLOWED (additive - doesn't affect old responses)

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
const change = addAnswerOption(scanner.draftVersion, 'q1', { 
  id: 'new-opt', 
  label: { en: 'New Option', ar: '' },
  score: 0 
});

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.canSave).toBe(true);
```

### Edge Case 7: Removing Answer Options

**Scenario**: Remove an answer option that has been selected in responses

**Expected**: BLOCKED

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(5);
// Option 'a2' was selected in responses
const change = removeAnswerOption(scanner.draftVersion, 'q1', 'a2');

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.impacts).toContainEqual(
  expect.objectContaining({ code: 'ANSWER_REMOVED', type: 'breaking' })
);
```

## Weight Change Edge Cases

### Edge Case 8: Changing Category Weight

**Scenario**: Change category weight from 20% to 30%

**Expected**: BLOCKED (affects historical score calculations)

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
const change = modifyCategoryWeight(scanner.draftVersion, 'cat1', 30);

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.impacts).toContainEqual(
  expect.objectContaining({ code: 'CATEGORY_WEIGHT_CHANGED', type: 'breaking' })
);
```

### Edge Case 9: Changing Subdomain Weight

**Scenario**: Change subdomain weight

**Expected**: BLOCKED

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
const change = modifySubdomainWeight(scanner.draftVersion, 'sub1', 25);

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.canSave).toBe(false);
```

## Hierarchy Edge Cases

### Edge Case 10: Moving Subdomain Between Categories

**Scenario**: Move subdomain from Category A to Category B

**Expected**: BLOCKED (changes hierarchy structure)

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
const change = moveSubdomain(scanner.draftVersion, 'sub1', 'cat1', 'cat2');

const result = detectScannerChanges(scanner.draftVersion, change);
// This would show as delete from one category, add to another
expect(result.impacts.some(i => i.type === 'breaking')).toBe(true);
```

### Edge Case 11: Adding Optional Category

**Scenario**: Add a new category to the scanner

**Expected**: ALLOWED (additive)

**Test**:
```typescript
const scanner = createScannerWith5Categories();
const change = addCategory(scanner.draftVersion, createNewCategory());

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.impacts).toContainEqual(
  expect.objectContaining({ code: 'CATEGORY_ADDED', type: 'additive' })
);
```

## Follow-up Trigger Edge Cases

### Edge Case 12: Adding Follow-up Trigger

**Scenario**: Add new follow-up trigger

**Expected**: ALLOWED (additive)

**Test**:
```typescript
const scanner = createScannerWithSubmissions(5);
const change = addFollowUpTrigger(scanner.draftVersion, {
  id: 'new-trigger',
  triggerQuestionId: 'q1',
  triggerOptionIds: ['a1'],
  followUpQuestionIds: ['q5']
});

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.canSave).toBe(true);
```

### Edge Case 13: Modifying Follow-up Trigger Semantics

**Scenario**: Change which answers trigger a follow-up

**Expected**: BLOCKED if responses exist

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(5);
const change = modifyFollowUpTrigger(scanner.draftVersion, 'trigger1', {
  triggerOptionIds: ['a1', 'a2'] // Changed from ['a1']
});

const result = detectScannerChanges(scanner.draftVersion, change);
// This could be considered breaking as it changes survey flow
expect(result.canSave).toBe(false);
```

## Text/Content Edge Cases

### Edge Case 14: Changing Question Text (No Semantic Change)

**Scenario**: Fix typo in question text

**Expected**: ALLOWED (safe)

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
const change = fixQuestionTypo(scanner.draftVersion, 'q1', 'Corrected question?');

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.impacts).toContainEqual(
  expect.objectContaining({ code: 'QUESTION_TEXT_CHANGED', type: 'safe' })
);
expect(result.canSave).toBe(true);
```

### Edge Case 15: Changing Answer Text (Semantic Change)

**Scenario**: Change answer option label to different meaning

**Expected**: Could be BLOCKED depending on interpretation

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(5);
// Changing "Agree" to "Strongly Agree" - semantic shift
const change = modifyAnswerLabel(scanner.draftVersion, 'q1', 'a1', 'Strongly Agree');

const result = detectScannerChanges(scanner.draftVersion, change);
// Text change is safe, but semantic implications noted
expect(result.impacts.some(i => i.type === 'safe')).toBe(true);
```

## Runtime Edge Cases

### Edge Case 16: Stale Runtime Config Mismatch

**Scenario**: Scanner edited after publish, runtime still uses old config

**Expected**: Runtime config is immutable snapshot - no issue

**Test**:
```typescript
// Publish scanner v1
const published = await publishScanner(scanner.id);

// Edit to create v2 draft
await saveScannerDraft(scanner.id, modifiedData);

// Runtime should still use v1
const runtime = await getTenantRuntimeConfig(tenant.id);
expect(runtime.scannerVersionId).toBe(published.draftVersionId);
```

### Edge Case 17: Multiple Rapid Saves

**Scenario**: User rapidly saves multiple changes

**Expected**: Each save is independently validated

**Test**:
```typescript
await saveScannerDraft(scanner.id, change1);
const result1 = detectScannerChanges(version1, change1);

await saveScannerDraft(scanner.id, change2);
const result2 = detectScannerChanges(version2, change2);
```

## Historical Analytics Edge Cases

### Edge Case 18: Mixed Safe and Breaking Changes

**Scenario**: User tries to save multiple changes, some safe, some breaking

**Expected**: Entire save blocked, must separate changes

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(5);
const change = {
  ...scanner.draftVersion,
  categories: [
    { ...cat1, weight: 30 }, // BREAKING: weight change
    { ...cat2, name: { en: 'Fixed name', ar: '' } } // SAFE: text change
  ]
};

const result = detectScannerChanges(scanner.draftVersion, change);
expect(result.canSave).toBe(false);
```

### Edge Case 19: Cumulative Small Changes

**Scenario**: Multiple small safe changes that together become significant

**Expected**: Each change individually assessed

**Test**:
```typescript
const scanner = await createScannerWithSubmissions(10);
// Multiple text changes
const change = makeMultipleTextChanges(scanner.draftVersion, 5);

const result = detectScannerChanges(scanner.draftVersion, change);
// All should be safe, no blocking
expect(result.canSave).toBe(true);
```