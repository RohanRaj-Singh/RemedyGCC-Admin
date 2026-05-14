# Scanner Versioning Edge Cases

## Edge Case 1: Orphan Versions

**Scenario**: Version exists but scanner root is deleted

**Risk**: Data corruption, lost version history

**Handling**: Version cleanup should cascade delete. Document references scanner by ID, not embedded.

**Test**: Delete scanner with multiple versions
```typescript
await deleteScanner(scannerId);
// All versions in adminScannerVersions should be deleted
```

## Edge Case 2: Duplicate Scanner Roots

**Scenario**: Two scanners with same content but different IDs

**Risk**: Confusion in version management

**Handling**: Duplicate creates NEW unique IDs, not references to original. Version lineage only within single scanner.

**Test**: Duplicate scanner, verify independent roots
```typescript
const dup = await duplicateScanner({ sourceScannerId, newName });
expect(dup.id).not.toBe(scanner.id);
expect(dup.versions[0].sourceVersionId).toBeNull(); // No lineage to original
```

## Edge Case 3: Stale Runtime References

**Scenario**: Runtime config references version that gets archived

**Risk**: Runtime errors, broken surveys

**Handling**: Runtime configs store frozen snapshots at publish time. Archiving doesn't affect existing configs.

**Test**: Archive version, verify existing runtime still works
```typescript
await archiveVersion(scannerId, oldVersionId);
const runtime = await getRuntimeConfig(tenantId);
// Should still work with frozen snapshot
```

## Edge Case 4: Active Version Deletion Attempt

**Scenario**: User tries to delete active version

**Risk**: Runtime failure

**Handling**: Archive flow checks `isActive` flag, blocks if true

**Test**: Attempt to archive active version
```typescript
await expect(archiveVersion(scannerId, activeVersionId)).rejects.toThrow();
```

## Edge Case 5: Duplicate Scanner Collisions

**Scenario**: Duplicate scanner with same name as existing

**Risk**: User confusion

**Handling**: Scanners identified by unique ID, names can duplicate. No collision prevention needed.

## Edge Case 6: Abandoned Drafts

**Scenario**: Multiple draft versions exist (should not happen)

**Risk**: Data inconsistency

**Handling**: `createNewVersion` checks for existing draft, returns early if found

**Test**: Try to create version when draft exists
```typescript
// Have draft v2
const result = await createNewVersion(scannerId);
// Should return existing draft, not create new
expect(result.draftVersion?.versionNumber).toBe(2);
```

## Edge Case 7: Publish Without Validation

**Scenario**: Invalid scanner published

**Risk**: Runtime errors

**Handling**: `publishScanner` calls `validateDraft` first, rejects if invalid

**Test**: Try to publish invalid scanner
```typescript
await saveScannerDraft(scannerId, { ...invalidData });
await expect(publishScanner(scannerId)).rejects.toThrow();
```

## Edge Case 8: Version Number Overflow

**Scenario**: Many versions created (v1000+)

**Risk**: Display issues, ID exhaustion

**Handling**: Version numbers stored as integers, can go to MAX_INT. Version ID is separate unique identifier.

## Edge Case 9: Race Condition in Activation

**Scenario**: Two activation requests for different versions simultaneously

**Risk**: Multiple active versions

**Handling**: Database operations should be atomic. Version activation deactivates others first.

## Edge Case 10: Concurrent Draft Saves

**Scenario**: User opens scanner in two tabs, saves in both

**Risk**: Data loss, version confusion

**Handling**: Current implementation allows last-write-wins. No optimistic locking.

## Edge Case 11: Archived Scanner Root

**Scenario**: Scanner status is archived, can versions still be used?

**Risk**: Cannot publish new versions, but existing runtime configs still work

**Handling**: Scanner status controls editing, not runtime. Archived scanner's published versions still work.

## Edge Case 12: Version with Responses

**Scenario**: Attempt to modify version that has submissions

**Risk**: Historical data corruption

**Handling**: Published versions are immutable. Editing always creates new version. Submissions reference specific version ID.

## Edge Case 13: No Active Version

**Scenario**: Scanner has published versions but none are active

**Risk**: Which version does runtime use?

**Handling**: Runtime falls back to latest published version. UI shows "None" for active version.

## Edge Case 14: Version State Inconsistency

**Scenario**: Version has status=published but isActive=false

**Risk**: Confusion about state

**Handling**: This is valid - published but not currently active. Visualized clearly in UI.

## Edge Case 15: Empty Version History

**Scenario**: Scanner with no versions (should not happen)

**Risk**: Cannot edit

**Handling**: Creating scanner always creates initial v1 draft. Empty version list only possible via direct DB manipulation.

## Edge Case 16: Network Failure During Save

**Scenario**: Save draft fails due to network error

**Risk**: User thinks saved but data lost

**Handling**: Service throws error, UI shows error message. No silent failures.

## Edge Case 17: Browser Close During Edit

**Scenario**: User closes browser tab with unsaved changes

**Risk**: Data loss

**Handling**: Browser beforeunload event shows confirmation dialog.

## Edge Case 18: Timezone Differences

**Scenario**: Published date shows differently in different timezones

**Risk**: Confusion about when versions were published

**Handling**: Store ISO timestamps, display using locale. `toLocaleDateString()` handles automatically.

## Edge Case 19: Scanner Name Changes

**Scenario**: Change scanner name after publishing versions

**Risk**: Historical confusion

**Handling**: Scanner root name is separate from version content. Older versions don't change name retroactively.

## Edge Case 20: Partial Publish Failure

**Scenario**: Publish fails partway through

**Risk**: Inconsistent state

**Handling**: MongoDB operations should be atomic or have rollback. Current implementation updates both scanner and version in single operations.