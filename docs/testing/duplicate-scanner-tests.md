# Duplicate Scanner Tests

## Overview

Tests for the Duplicate Scanner workflow that creates independent scanner copies.

## Core Duplication Tests

### Test: Duplicate Scanner Creates New Identity

```typescript
const original = await createScanner({ name: { en: 'Original', ar: '' } });
await publishScanner(original.id);

const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Duplicated', ar: '' },
});

expect(duplicated.id).not.toBe(original.id);
expect(duplicated.name.en).toBe('Duplicated');
expect(duplicated.status).toBe('draft');
expect(duplicated.duplicatedFromScannerId).toBe(original.id);
```

### Test: Duplicated Scanner Has Independent Submissions

```typescript
const original = await createScannerWithSubmissions(10);
const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Duplicated', ar: '' },
});

expect(duplicated.hasResponses).toBe(false);
// Submissions are isolated
const originalSubmissions = await getSubmissions(original.id);
expect(originalSubmissions.length).toBe(10);

const duplicatedSubmissions = await getSubmissions(duplicated.id);
expect(duplicatedSubmissions.length).toBe(0);
```

### Test: Full Structure Cloning

```typescript
const original = await createScannerWithFullStructure();
original.draftVersion.categories.forEach(cat => {
  cat.subdomains.forEach(sub => {
    expect(sub.questions.length).toBeGreaterThan(0);
  });
});

const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Copy', ar: '' },
});

expect(duplicated.categoryCount).toBe(original.categoryCount);
expect(duplicated.subdomainCount).toBe(original.subdomainCount);
expect(duplicated.questionCount).toBe(original.questionCount);

// Verify questions match
const origQuestion = original.draftVersion.categories[0].subdomains[0].questions[0];
const dupQuestion = duplicated.draftVersion!.categories[0].subdomains[0].questions[0];
expect(dupQuestion.text.en).toBe(origQuestion.text.en);
expect(dupQuestion.options[0].score).toBe(origQuestion.options[0].score);
```

### Test: New Root Identifier

```typescript
const original = await createScanner({ name: { en: 'Original', ar: '' } });

const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Copy', ar: '' },
});

// New IDs should be generated
expect(duplicated.id).toMatch(/^scanner-/);
expect(duplicated.id).not.toBe(original.id);

const origVersionId = original.draftVersion?.id;
const dupVersionId = duplicated.draftVersion?.id;
expect(dupVersionId).not.toBe(origVersionId);
expect(dupVersionId).toMatch(/^scanner-version-/);
```

### Test: Post-Duplicate Edit Freedom

```typescript
const original = await createScannerWithSubmissions(10);
const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Copy', ar: '' },
});

// Breaking changes should be allowed on duplicated scanner
const breakingChange = {
  ...duplicated.draftVersion,
  categories: duplicated.draftVersion!.categories.map(cat => ({
    ...cat,
    weight: cat.weight + 10,
  })),
};

const result = detectScannerChanges(duplicated.draftVersion!, breakingChange as ScannerVersion);
// No responses, so should be allowed
expect(result.canSave).toBe(true);
```

## Runtime Isolation Tests

### Test: Runtime Config Isolation

```typescript
const original = await createScannerWithSubmissions(10);
// Publish original
await publishScanner(original.id);
const originalRuntime = await getTenantRuntimeConfig(original.id);

const duplicated = await duplicateScanner({...});
// Publish duplicated
await publishScanner(duplicated.id);
const duplicatedRuntime = await getTenantRuntimeConfig(duplicated.id);

expect(originalRuntime.scannerVersionId).not.toBe(duplicatedRuntime.scannerVersionId);
expect(originalRuntime.id).not.toBe(duplicatedRuntime.id);
```

### Test: Submission Isolation

```typescript
const original = await createPublishedScanner();
// Submit to original
await submitResponse(original.id, { ... });

const duplicated = await duplicateScanner({...});
// Submit to duplicated
await submitResponse(duplicated.id, { ... });

const originalSubs = await getSubmissions(original.id);
const duplicatedSubs = await getSubmissions(duplicated.id);

expect(originalSubs.length).toBe(1);
expect(duplicatedSubs.length).toBe(1);
expect(originalSubs[0].runtimeConfigId).not.toBe(duplicatedSubs[0].runtimeConfigId);
```

## Dashboard Isolation Tests

### Test: Dashboard Data Separation

```typescript
const original = await createPublishedScanner();
// Submit multiple responses to original
for (let i = 0; i < 10; i++) {
  await submitResponse(original.id, generateResponse());
}

const duplicated = await duplicateScanner({...});
// Submit different responses to duplicated
for (let i = 0; i < 5; i++) {
  await submitResponse(duplicated.id, generateResponse());
}

// Dashboard should be separate
const originalDashboard = await getDashboard(original.id);
const duplicatedDashboard = await getDashboard(duplicated.id);

expect(originalDashboard.totalSubmissions).toBe(10);
expect(duplicatedDashboard.totalSubmissions).toBe(5);
```

### Test: No Merged Analytics

```typescript
const original = await createScanner();
await publishScanner(original.id);
await submitResponse(original.id, { scores: { tech: 80, finance: 60 } });

const duplicated = await duplicateScanner({...});
await publishScanner(duplicated.id);
await submitResponse(duplicated.id, { scores: { tech: 90, finance: 70 } });

// Original dashboard should not include duplicated submissions
const originalDashboard = await getDashboard(original.id);
expect(originalDashboard.scores.tech).toBe(80);
// Not 80 AND 90 merged

// Duplicated dashboard should be independent
const duplicatedDashboard = await getDashboard(duplicated.id);
expect(duplicatedDashboard.scores.tech).toBe(90);
```

## Source Traceability Tests

### Test: Source Reference Stored

```typescript
const original = await createScanner();
const duplicated = await duplicateScanner({
  sourceScannerId: original.id,
  newName: { en: 'Copy', ar: '' },
});

expect(duplicated.duplicatedFromScannerId).toBe(original.id);

// Original should not have reference to duplicated
const originalFetched = await getScanner(original.id);
expect(originalFetched.duplicatedFromScannerId).toBeUndefined();
```

### Test: No Runtime Dependency

```typescript
const original = await createPublishedScanner();
const originalRuntime = await getTenantRuntimeConfig(original.id);

const duplicated = await duplicateScanner({...});

// Deleting original should not affect duplicated
await deleteScanner(original.id);

const duplicatedStillWorks = await getScanner(duplicated.id);
expect(duplicatedStillWorks).toBeDefined();
```

## Validation Tests

### Test: Duplicate Name Collision Prevention

```typescript
await createScanner({ name: { en: 'Existing Scanner', ar: '' } });
const toDuplicate = await createScanner({ name: { en: 'To Duplicate', ar: '' } });

// Same name should be allowed (not enforced collision check)
// But UI should suggest "(Copy)" suffix
const duplicated = await duplicateScanner({
  sourceScannerId: toDuplicate.id,
  newName: { en: 'Existing Scanner', ar: '' }, // Intentional reuse
});

expect(duplicated.name.en).toBe('Existing Scanner');
```

### Test: Invalid Source Scanner

```typescript
await expect(duplicateScanner({
  sourceScannerId: 'non-existent-id',
  newName: { en: 'Copy', ar: '' },
})).rejects.toThrow('Source scanner not found');
```

### Test: Scanner Without Versions

```typescript
const emptyScanner = await createScanner({ name: { en: 'Empty', ar: '' } });
// Delete any versions if possible, or test with partially created

await expect(duplicateScanner({
  sourceScannerId: emptyScanner.id,
  newName: { en: 'Copy', ar: '' },
})).rejects.toThrow('Source scanner has no version to duplicate');
```

## UI Integration Tests

### Test: Duplicate Modal Opens

```typescript
const { getByText } = render(<ScannerListPage scanners={[scanner]} />);

fireEvent.click(getByText('Duplicate'));
expect(getByText('Duplicate Scanner')).toBeInTheDocument();
```

### Test: Duplicate Modal Pre-fills Name

```typescript
const { getByDisplayValue } = render(
  <DuplicateScannerModal
    isOpen={true}
    sourceScannerName="Healthcare Scanner"
    {...}
  />
);

expect(getByDisplayValue('Healthcare Scanner (Copy)')).toBeInTheDocument();
```

### Test: Breaking Change Modal Directs to Duplicate

```typescript
const scannerWithResponses = await createScannerWithSubmissions(10);
// Attempt breaking change
render(<BreakingChangeModal ... />);

expect(getByText('Duplicate Scanner')).toBeInTheDocument();
```

## Success Flow Tests

### Test: Post-Duplication Navigation

```typescript
// User duplicates from list page
await fireEvent.click(getByText('Duplicate'));
await fireEvent.click(getByText('Duplicate Scanner'));

// Should navigate to edit page
expect(router.push).toHaveBeenCalledWith(
  expect.stringContaining('/scanners/[new-id]/edit')
);
```

### Test: Success Confirmation Message

```typescript
// After successful duplication
const { getByText } = render(
  <SuccessMessage message="Scanner duplicated successfully. You are now editing an independent scanner." />
);

expect(getByText(/duplicated successfully/)).toBeInTheDocument();
```