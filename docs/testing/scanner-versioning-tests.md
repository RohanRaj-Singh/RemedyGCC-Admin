# Scanner Versioning Tests

## Test Scenarios

### 1. Create New Scanner

**Test**: Create a scanner and verify initial state

```typescript
// Create scanner
const scanner = await createScanner({
  name: { en: 'Test Scanner', ar: 'ماسح الاختبار' },
  description: { en: 'A test scanner', ar: 'ماسح اختبار' }
});

expect(scanner.status).toBe('draft');
expect(scanner.versionStats.total).toBe(1);
expect(scanner.versionStats.draft).toBe(1);
expect(scanner.versionStats.published).toBe(0);
expect(scanner.latestVersionNumber).toBe(1);
```

**Expected**: Scanner created with v1 in draft status

### 2. Save Draft

**Test**: Save changes to draft version

```typescript
const saved = await saveScannerDraft(scanner.id, {
  name: { en: 'Updated Name', ar: 'اسم محدث' },
  description: { en: 'Updated description', ar: 'وصف محدث' },
  categories: updatedCategories,
  followUpTriggers: updatedTriggers
});

expect(saved.draftVersion).toBeDefined();
expect(saved.hasUnpublishedChanges).toBe(false);
```

**Expected**: Draft saved successfully, no pending changes flag reset

### 3. Publish Scanner

**Test**: Publish a valid scanner

```typescript
// First ensure scanner has valid structure (5 categories, weights sum to 100)
const published = await publishScanner(scanner.id);

expect(published.publishedVersion).toBeDefined();
expect(published.publishedVersion?.status).toBe('published');
expect(published.status).toBe('published');
expect(published.publishedVersion?.publishedAt).toBeDefined();
```

**Expected**: Version becomes published, publishedAt timestamp set

### 4. Create New Version

**Test**: Create new version from published scanner

```typescript
// First publish a scanner
await publishScanner(scanner.id);

// Create new version
const newVersion = await createNewVersion(scanner.id);

expect(newVersion.draftVersion).toBeDefined();
expect(newVersion.draftVersion?.versionNumber).toBe(2);
expect(newVersion.draftVersion?.sourceVersionId).toBe(published.publishedVersion?.id);
expect(newVersion.latestVersionNumber).toBe(2);
```

**Expected**: New draft version v2 created with content cloned from v1

### 5. Activate Version

**Test**: Activate a published version

```typescript
// Create and publish v2
await createNewVersion(scanner.id);
const v2 = await publishScanner(scanner.id);

// Activate v2
const activated = await activateVersion(scanner.id, v2.publishedVersion!.id);

expect(activated.activeVersion?.id).toBe(v2.publishedVersion?.id);
expect(activated.activeVersion?.isActive).toBe(true);
```

**Expected**: Version activated, previous active version deactivated

### 6. Archive Version

**Test**: Archive a non-active published version

```typescript
// Create and publish multiple versions
await createNewVersion(scanner.id);
await publishScanner(scanner.id);
await createNewVersion(scanner.id);
const v3 = await publishScanner(scanner.id);

// Activate v3
await activateVersion(scanner.id, v3.publishedVersion!.id);

// Archive v2 (not active)
const archived = await archiveVersion(scanner.id, v2.publishedVersion!.id);

const v2Version = archived.versions.find(v => v.id === v2.publishedVersion!.id);
expect(v2Version?.status).toBe('archived');
expect(v2Version?.archivedAt).toBeDefined();
```

**Expected**: Version archived successfully

### 7. Duplicate Scanner

**Test**: Duplicate a scanner to create new root

```typescript
const original = await getScannerById(originalScannerId);

const duplicated = await duplicateScanner({
  sourceScannerId: originalScannerId,
  newName: { en: 'Duplicated Scanner', ar: 'ماسح مكرر' },
  newDescription: { en: 'A copy', ar: 'نسخة' }
});

expect(duplicated.id).not.toBe(original.id);
expect(duplicated.latestVersionNumber).toBe(1);
expect(duplicated.versionStats.total).toBe(1);
expect(duplicated.versionStats.draft).toBe(1);
// Content should match
expect(duplicated.draftVersion?.categories).toEqual(original.publishedVersion?.categories);
```

**Expected**: New scanner root created with cloned content

### 8. Unsaved Changes Detection

**Test**: Verify unsaved changes are detected

```typescript
const form = render(<ScannerForm scanner={scanner} />);

// Initially no unsaved changes
expect(form.hasUnsavedChanges).toBe(false);

// Change form field
form.setName({ en: 'Changed Name', ar: 'اسم مختلف' });

// Should now have unsaved changes
expect(form.hasUnsavedChanges).toBe(true);
```

**Expected**: Unsaved changes flag set when form differs from initial state

### 9. Unsaved Changes Dialog

**Test**: Verify dialog appears on navigation attempt

```typescript
const form = render(<ScannerForm scanner={scanner} />);

// Make changes
form.setName({ en: 'Changed', ar: 'مختلف' });

// Attempt navigation
form.attemptNavigate();

// Dialog should appear
expect(form.showUnsavedDialog).toBe(true);
```

**Expected**: Dialog blocks navigation when unsaved changes exist

### 10. Version Visibility

**Test**: Verify all versions visible in list

```typescript
const scanner = await getScannerById(scannerId);

// Create multiple versions
await publishScanner(scanner.id);
await createNewVersion(scanner.id);
await publishScanner(scanner.id);
await createNewVersion(scanner.id);
await publishScanner(scanner.id);

const updated = await getScannerById(scannerId);

expect(updated.versions.length).toBe(5);
expect(updated.versionStats.total).toBe(5);
expect(updated.versionStats.draft).toBe(1);
expect(updated.versionStats.published).toBe(3);
expect(updated.versionStats.archived).toBe(1);
```

**Expected**: All versions visible with correct counts

### 11. Runtime Compatibility

**Test**: Verify published versions work with runtime

```typescript
// Publish scanner
const published = await publishScanner(scanner.id);

// Activate
const activated = await activateVersion(scanner.id, published.publishedVersion!.id);

// Runtime config should reference scanner version
const runtimeConfig = await getRuntimeConfigForTenant(tenantId);

expect(runtimeConfig.scannerVersion.id).toBe(activated.activeVersion?.id);
```

**Expected**: Runtime config uses published version ID

### 12. Prevent Active Version Archive

**Test**: Verify cannot archive active version

```typescript
await expect(
  archiveVersion(scanner.id, activeVersionId)
).rejects.toThrow('Cannot archive the active version');
```

**Expected**: Error thrown when attempting to archive active version

## Integration Tests

### Publish Flow Integration

```typescript
// Full publish flow
const scanner = await createScanner({ name: { en: 'Test', ar: 'اختبار' }});

// Build valid scanner
const validScanner = await saveScannerDraft(scanner.id, {
  name: { en: 'Test', ar: 'اختبار' },
  categories: createValidCategories(), // 5 categories, weights = 100
  followUpTriggers: []
});

// Publish
const published = await publishScanner(validScanner.id);

// Activate
const activated = await activateVersion(validScanner.id, published.publishedVersion!.id);

// Verify state
expect(activated.activeVersion?.isActive).toBe(true);
expect(activated.versionStats.published).toBe(1);
```

### Version Reuse Detection

```typescript
// Create v1
await createNewVersion(scanner.id);
const v1 = await publishScanner(scanner.id);

// Create v2 with SAME content as v1
await createNewVersion(scanner.id);
const v2 = await saveScannerDraft(scanner.id, {
  // Same content as v1
  ...v1.publishedVersion
});
await publishScanner(scanner.id);

// Fingerprints should match for version reuse optimization
const scannerDetail = await getScannerById(scanner.id);
// System should detect content match and potentially reuse version IDs
```