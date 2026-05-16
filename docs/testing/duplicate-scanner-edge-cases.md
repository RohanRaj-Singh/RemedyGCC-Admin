# Duplicate Scanner Edge Cases

## Duplication Source Edge Cases

### Edge Case 1: Duplicate Scanner That Was Itself Duplicated

**Scenario**: Duplicate a scanner that was created by duplication

**Expected**: Works normally, source traceability maintained

**Test**:
```typescript
const original = await createScanner();
const level1 = await duplicateScanner({ sourceScannerId: original.id, newName: { en: 'Level 1', ar: '' } });
const level2 = await duplicateScanner({ sourceScannerId: level1.id, newName: { en: 'Level 2', ar: '' } });

expect(level2.duplicatedFromScannerId).toBe(level1.id);
// Level 2's structure should match Level 1's (which matches Original)
```

### Edge Case 2: Duplicate Deleted Scanner

**Scenario**: Attempt to duplicate a scanner that no longer exists

**Expected**: Error "Source scanner not found"

**Test**:
```typescript
const scanner = await createScanner();
await deleteScanner(scanner.id);

await expect(duplicateScanner({
  sourceScannerId: scanner.id,
  newName: { en: 'Copy', ar: '' },
})).rejects.toThrow('Source scanner not found');
```

### Edge Case 3: Duplicate Archived Scanner

**Scenario**: Duplicate a scanner that is archived

**Expected**: May or may not be allowed depending on business rules

**Test**:
```typescript
const scanner = await createScanner();
await archiveScanner(scanner.id);

// Depends on policy - current implementation should allow
const duplicated = await duplicateScanner({
  sourceScannerId: scanner.id,
  newName: { en: 'Copy', ar: '' },
});
expect(duplicated.status).toBe('draft');
```

## Structure Edge Cases

### Edge Case 4: Duplicate Scanner with No Questions

**Scenario**: Duplicate a scanner that has empty structure

**Expected**: Created successfully with empty structure

**Test**:
```typescript
const emptyScanner = createScannerWithEmptyStructure();
const duplicated = await duplicateScanner({
  sourceScannerId: emptyScanner.id,
  newName: { en: 'Copy', ar: '' },
});

expect(duplicated.questionCount).toBe(0);
expect(duplicated.categories.length).toBe(5); // Default categories
```

### Edge Case 5: Duplicate Scanner with Complex Follow-ups

**Scenario**: Scanner has intricate follow-up trigger chains

**Expected**: All follow-up references preserved correctly

**Test**:
```typescript
const scanner = createScannerWithComplexFollowUps();
// Follow-ups reference specific questions
const duplicated = await duplicateScanner({...});

// Verify follow-up IDs are mapped correctly
duplicated.draftVersion!.followUpTriggers.forEach(trigger => {
  const targetQuestion = findQuestion(duplicated.draftVersion!, trigger.followUpQuestionIds[0]);
  expect(targetQuestion).toBeDefined();
});
```

### Edge Case 6: Duplicate Scanner with All Categories

**Scenario**: Scanner has maximum allowed categories/subdomains/questions

**Expected**: All structure copied correctly, no truncation

**Test**:
```typescript
const largeScanner = createLargeScanner(); // 5 cats, 10 subs each, 50 questions each
const duplicated = await duplicateScanner({...});

expect(duplicated.categoryCount).toBe(largeScanner.categoryCount);
expect(duplicated.subdomainCount).toBe(largeScanner.subdomainCount);
expect(duplicated.questionCount).toBe(largeScanner.questionCount);
```

## Runtime Isolation Edge Cases

### Edge Case 7: Original Published, Duplicated Not Yet Published

**Scenario**: Original has runtime config, duplicated doesn't

**Expected**: Independent, duplicated has no runtime until published

**Test**:
```typescript
const original = await createPublishedScanner();
const originalRuntime = await getTenantRuntimeConfig(original.id);

const duplicated = await duplicateScanner({...});

// Duplicated should not have runtime config yet
try {
  await getTenantRuntimeConfig(duplicated.id);
  fail('Should not have runtime config');
} catch (e) {
  // Expected - no active runtime
}
```

### Edge Case 8: Both Published, Different Content Changes

**Scenario**: Edit original after duplication, don't edit duplicated

**Expected**: Each scanner has its own published state

**Test**:
```typescript
const original = await createPublishedScanner();
const duplicated = await duplicateScanner({...});

// Edit original
await saveScannerDraft(original.id, modifiedCategories);
await publishScanner(original.id);

// Duplicated still has original content
const dupPublished = duplicated.publishedVersion ?? duplicated.draftVersion;
// Should match the original content at duplication time, not modified version
```

### Edge Case 9: Original Deleted, Duplicated Remains

**Scenario**: Delete original after duplication

**Expected**: Duplicated unaffected, continues to work

**Test**:
```typescript
const original = await createPublishedScanner();
const duplicated = await duplicateScanner({...});

await deleteScanner(original.id);

const stillWorks = await getScanner(duplicated.id);
expect(stillWorks).toBeDefined();
expect(stillWorks.status).toBe('draft');
```

## Submission Edge Cases

### Edge Case 10: Duplicate Scanner After Submissions

**Scenario**: Original has submissions when duplicated

**Expected**: Duplicated starts with 0 submissions, independent

**Test**:
```typescript
const original = await createPublishedScanner();
await submitResponse(original.id, { ... });
await submitResponse(original.id, { ... });

const duplicated = await duplicateScanner({...});

expect(original.hasResponses).toBe(true);
expect(duplicated.hasResponses).toBe(false);
expect(duplicated.versions[0].responseCount).toBe(0);
```

### Edge Case 11: Submit to Original After Duplication

**Scenario**: New submissions to original don't affect duplicated

**Expected**: Complete isolation

**Test**:
```typescript
const original = await createPublishedScanner();
const duplicated = await duplicateScanner({...});

await submitResponse(original.id, { score: 80 });
await submitResponse(original.id, { score: 90 });

const originalSubs = await getSubmissions(original.id);
const duplicatedSubs = await getSubmissions(duplicated.id);

expect(originalSubs.length).toBe(2);
expect(duplicatedSubs.length).toBe(0);
```

### Edge Case 12: Duplicate Then Submit to Both

**Scenario**: Both scanners receive independent submissions

**Expected**: Each maintains its own submission count

**Test**:
```typescript
const original = await createPublishedScanner();
const duplicated = await duplicateScanner({...});

await submitResponse(original.id, { q1: 'a1' });
await submitResponse(duplicated.id, { q1: 'a2' });

// Each should have exactly their own submissions
const origCount = await countSubmissions(original.id);
const dupCount = await countSubmissions(duplicated.id);

expect(origCount).toBe(1);
expect(dupCount).toBe(1);
```

## Dashboard Isolation Edge Cases

### Edge Case 13: Mixed Dashboard Queries

**Scenario**: Dashboard aggregates by scanner

**Expected**: No cross-contamination

**Test**:
```typescript
const original = await createPublishedScanner();
const duplicated = await duplicateScanner({...});

await submitResponse(original.id, generateResponse({ category: 'tech', score: 80 }));
await submitResponse(duplicated.id, generateResponse({ category: 'tech', score: 60 }));

const origDash = await getDashboard(original.id);
const dupDash = await getDashboard(duplicated.id);

expect(origDash.scores.tech).toBe(80);
expect(dupDash.scores.tech).toBe(60);
// NOT averaged or mixed
```

### Edge Case 14: Archived Original, Active Duplicated

**Scenario**: Archive original, duplicated remains active

**Expected**: Independent states

**Test**:
```typescript
const original = await createPublishedScanner();
const duplicated = await duplicateScanner({...});

await archiveScanner(original.id);

const orig = await getScanner(original.id);
const dup = await getScanner(duplicated.id);

expect(orig.status).toBe('archived');
expect(dup.status).toBe('draft');
```

## Validation Edge Cases

### Edge Case 15: Empty Scanner Name

**Scenario**: Attempt to duplicate with empty name

**Expected**: Validation error prevents duplication

**Test**:
```typescript
const scanner = await createScanner();

await expect(duplicateScanner({
  sourceScannerId: scanner.id,
  newName: { en: '', ar: '' },
})).rejects.toThrow('Scanner name is required');
```

### Edge Case 16: Very Long Scanner Name

**Scenario**: Duplicate with extremely long name

**Expected**: Accepted or truncated depending on UI limits

**Test**:
```typescript
const scanner = await createScanner();
const longName = 'A'.repeat(500);

const duplicated = await duplicateScanner({
  sourceScannerId: scanner.id,
  newName: { en: longName, ar: '' },
});

expect(duplicated.name.en.length).toBeLessThanOrEqual(255); // DB limit
```

### Edge Case 17: Duplicate with Special Characters

**Scenario**: Name contains special characters like `<>&"'`

**Expected**: Properly escaped and stored

**Test**:
```typescript
const scanner = await createScanner();
const specialName = { en: 'Scanner "Test" <Special> & More', ar: '' };

const duplicated = await duplicateScanner({
  sourceScannerId: scanner.id,
  newName: specialName,
});

expect(duplicated.name.en).toBe(specialName.en);
```

## Metadata Edge Cases

### Edge Case 18: Duplicate Preserves All Metadata

**Scenario**: Original has description and other metadata

**Expected**: All metadata copied except name

**Test**:
```typescript
const original = await createScanner({
  name: { en: 'Original', ar: '' },
  description: { en: 'Important description', ar: '' },
});

const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Copy', ar: '' },
});

expect(duplicated.description?.en).toBe(original.description?.en);
// But name is different as specified
expect(duplicated.name.en).toBe('Copy');
```

### Edge Case 19: Duplicate Scanner with No Description

**Scenario**: Original has no description

**Expected**: Duplicated also has no description

**Test**:
```typescript
const original = await createScanner({ name: { en: 'Original', ar: '' } });
// No description set

const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Copy', ar: '' },
});

expect(duplicated.description).toBeUndefined();
```

## Follow-up Reference Edge Cases

### Edge Case 20: Broken Follow-up After Question Deletion

**Scenario**: Delete question that was referenced in follow-up on original, then duplicate

**Expected**: Duplication should fail or clean up broken references

**Test**:
```typescript
const scanner = createScannerWithFollowUp();
await deleteQuestion(scanner, 'q1'); // Follow-up references q1

// Duplicate should handle gracefully
const duplicated = await duplicateScanner({...});

// Duplicated should either:
// 1. Fail with validation error
// 2. Successfully duplicate with cleaned follow-ups
```

### Edge Case 21: Question ID Collision Prevention

**Scenario**: Verify duplicated questions have new IDs

**Expected**: No ID collisions between original and duplicated

**Test**:
```typescript
const original = await createPublishedScanner();
const duplicated = await duplicateScanner({...});

const originalQuestionIds = new Set(
  original.draftVersion!.categories.flatMap(c => c.subdomains.flatMap(s => s.questions.map(q => q.id)))
);
const duplicatedQuestionIds = new Set(
  duplicated.draftVersion!.categories.flatMap(c => c.subdomains.flatMap(s => s.questions.map(q => q.id)))
);

// No overlap
for (const id of originalQuestionIds) {
  expect(duplicatedQuestionIds.has(id)).toBe(false);
}
```