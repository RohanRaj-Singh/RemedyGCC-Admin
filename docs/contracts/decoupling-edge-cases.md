# Decoupling Edge Cases

This document describes edge cases and migration scenarios related to the Scanner-Attribute Template decoupling.

## Runtime Migration

### Old Runtime Configs (Pre-Decoupling)

Runtime configs published before the decoupling change may have:
- Scanner versions that include `attributeTemplateId` (now ignored)
- Attribute template data embedded in scanner snapshot

**Handling**: The runtime app should gracefully handle both old and new runtime config formats. The scanner's `attributeTemplateId` field is simply not used - the runtime config's top-level `attributeTemplate` field is used instead.

### Mixed Mode During Transition

During the transition period, tenants may have:
- Draft scanner selected (new model - no attribute template)
- Draft attribute template selected (independent)

**Handling**: The publish flow validates both are selected before allowing publish. No special migration needed.

## Stale References

### Scanner Version References

**Scenario**: A Scanner was published with an Attribute Template. The Scanner is then updated to a new version without changing the tenant's attribute template selection.

**Result**: The old published runtime config still references the old scanner version with its embedded attribute template reference. New runtime configs use the independent selection.

**Mitigation**: This is expected behavior. Each publish creates an independent snapshot.

### Deleted Attribute Templates

**Scenario**: A Scanner was paired with Attribute Template X. Attribute Template X is deleted. The tenant still has Scanner selected.

**Result**: The existing published runtime configs remain valid (they have frozen snapshots). New publishes require selecting a valid attribute template.

**Mitigation**: Tenant editing UI should validate that selected attribute template still exists before allowing publish.

## Dashboard Compatibility

### Aggregation Queries

The aggregation system should continue to work because:
1. Runtime configs store both scanner version and attribute template version independently
2. Submission documents reference runtime config IDs, not scanner/attribute directly
3. Score calculations use the scanner version from the runtime config
4. Demographic filtering uses the attribute template from the runtime config

**Verification**: Ensure aggregation queries join through runtime config, not directly to scanner or attribute template documents.

### Submission Payloads

Submission payloads include:
- `runtimeConfigId`: References the complete runtime configuration
- `answers`: Scanner responses with question IDs
- `attributes`: Demographic responses mapped to attribute template structure

The decoupling does not affect submission payload structure.

## Publish Compatibility

### Version Reuse Detection

The fingerprint-based version reuse should work correctly:
- Scanner fingerprint excludes attribute template references
- Attribute template fingerprint is independent
- Both can be reused independently based on content matches

### Immutable Publishing

The immutable publishing model remains intact:
- Editing scanner drafts creates new versions (does not mutate published)
- Editing attribute drafts creates new versions (does not mutate published)
- Each publish creates a new runtime config snapshot

**Verification**: Ensure version history shows correct lineage after decoupling.

## Scanner Independence

### Scanner Without Attribute Template

**Scenario**: A Scanner is created without any attribute template (post-decoupling).

**Result**: Valid state. The scanner can be saved and published once an attribute template is selected at the tenant level.

### Attribute Template Without Scanner

**Scenario**: An Attribute Template exists but no scanner is selected.

**Result**: Valid state. The attribute template can be created and managed independently.

## Tenant-Level Validation

### Publishing Readiness Check

The tenant publishing readiness check should verify:
1. `draftScannerId` is set and references a valid, publishable scanner
2. `draftAttributeTemplateId` is set and references a valid attribute template
3. `branding` is valid

### Validation Error Messages

Updated error messages:
- "Choose a scanner before publishing this survey." (was previously coupled)
- "Choose an attribute template before publishing this survey." (was previously coupled)
- "The selected scanner expects a different attribute template..." (removed - no longer applicable)

## Testing Checklist

### Scanner Module Tests
- [ ] Scanner can be created without attribute template
- [ ] Scanner draft can be saved without attribute template
- [ ] Scanner can be published without attribute template
- [ ] Scanner validation works without attribute template
- [ ] Scanner version history works correctly

### Tenant Publishing Tests
- [ ] Tenant can select scanner and attribute template independently
- [ ] Publishing succeeds with both selected
- [ ] Publishing fails when scanner not selected
- [ ] Publishing fails when attribute template not selected
- [ ] Runtime config contains independent frozen versions

### Runtime Config Tests
- [ ] Runtime config generation works with independent inputs
- [ ] Version reuse works based on content fingerprints
- [ ] Old runtime configs (pre-decoupling) still work
- [ ] Dashboard aggregation works with new structure

### Migration Tests
- [ ] Existing scanners with attribute template data still work
- [ ] Existing runtime configs load correctly
- [ ] Submission history is preserved
- [ ] No data loss during migration

## Rollback Considerations

If rollback is needed:
1. Re-add `attributeTemplateId` to `ScannerVersion` type
2. Re-add attribute template resolution in scanner service
3. Restore validation that checks scanner has attribute template
4. Update tenant service to use scanner's attribute template as fallback

This would be a breaking change for new scanners but restore backward compatibility.