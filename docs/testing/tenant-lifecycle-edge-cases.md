# Tenant Lifecycle Edge Cases

## Edge Case 1: Restoring Reused Subdomains

**Scenario**: Archived tenant's original subdomain was reused by another tenant before restore

**Risk**: Restore fails with subdomain conflict

**Handling**: 
- Restore function checks if original subdomain is taken
- If taken, requires user to provide new subdomain
- Error message clearly explains the situation

**Test**:
```typescript
const archived = await archiveTenant(tenant1.id);
// Another tenant takes 'myorg'
await createTenant({ subdomain: 'myorg' });

await expect(restoreTenant(archived.id)).rejects.toThrow('subdomain is already in use');
// Must provide new subdomain
const restored = await restoreTenant(archived.id, 'neworg');
```

## Edge Case 2: Deleting Active Tenant

**Scenario**: Attempt to delete tenant that has active runtime

**Risk**: Runtime corruption, orphaned data

**Handling**: 
- Delete validation checks for `activeRuntimeConfigId`
- Blocked with clear error message

**Test**:
```typescript
await publishTenantRuntime(tenant.id, { activate: true });
await expect(deleteTenant(tenant.id, 'slug')).rejects.toThrow(
  'Only draft tenants without submissions or published configuration history'
);
```

## Edge Case 3: Archiving Live Tenant

**Scenario**: Archiving a tenant that has active submissions

**Risk**: Breaking active survey for respondents

**Handling**:
- Archive is allowed for active tenants
- Warning explains survey will be disabled immediately
- Submissions and history preserved
- Can be restored later

**Test**:
```typescript
const tenant = await createActiveTenant();
const archived = await archiveTenant(tenant.id);

expect(archived.status).toBe('archived');
// Survey links no longer work
const response = await makeRequest(archived.subdomain);
expect(response.status).toBe(404);
```

## Edge Case 4: Runtime Hostname Collisions

**Scenario**: Archived subdomain matches another active tenant

**Risk**: Wrong tenant resolution

**Handling**:
- Archived tenants change subdomain to `archived_{slug}_{date}`
- Original subdomain becomes available
- No collision possible

**Test**:
```typescript
// Tenant A archived
await archiveTenant(tenantA.id); // subdomain becomes 'archived_orga_20260515'

// Tenant B uses original subdomain
const tenantB = await createTenant({ subdomain: 'orga' });

// Both resolve correctly
expect(getTenantBySubdomain('orga').id).toBe(tenantB.id);
expect(getTenantBySubdomain('archived_orga_20260515').id).toBe(tenantA.id);
```

## Edge Case 5: Stale Runtime References

**Scenario**: Runtime config references archived tenant

**Risk**: Broken submissions, dashboard queries

**Handling**:
- Runtime configs store frozen snapshots at publish time
- Archiving doesn't delete runtime configs
- Historical data remains queryable
- Only new access is blocked

**Test**:
```typescript
await publishTenantRuntime(tenant.id, { activate: true });
const configId = tenant.activeRuntimeConfigId;

await archiveTenant(tenant.id);

// Existing runtime config still works
const config = await getRuntimeConfig(configId);
expect(config.scannerVersion).toBeDefined();

// But new access is blocked
const response = await makeRequest(tenant.subdomain);
expect(response.status).toBe(404);
```

## Edge Case 6: Invalid State Transitions

**Scenario**: Attempting invalid status changes

**Risk**: Data inconsistency

**Handling**:
- Service validates transitions
- Clear error messages for invalid transitions

**Test**:
```typescript
// Draft to archived (valid)
const archived = await archiveTenant(draftTenant.id);

// Archived to active (invalid - must restore first)
await expect(updateTenant(archived.id, { status: 'active' })).rejects.toThrow();

// Must use restore
const restored = await restoreTenant(archived.id);
expect(restored.status).toBe('disabled');
```

## Edge Case 7: Delete Active Tenant

**Scenario**: Attempt to delete tenant that's been published

**Risk**: Data loss, broken history

**Handling**:
- Delete only allowed for draft tenants with no history
- Published tenants blocked with clear message

**Test**:
```typescript
await publishTenantRuntime(tenant.id, { activate: false });

await expect(deleteTenant(tenant.id, 'slug')).rejects.toThrow(
  'Only draft tenants without submissions or published configuration history'
);
```

## Edge Case 8: Restore to Different Subdomain

**Scenario**: Restoring archived tenant to new subdomain

**Risk**: Confusion about tenant identity

**Handling**:
- Restore accepts optional newSubdomain parameter
- If provided, uses that subdomain
- Original subdomain becomes available

**Test**:
```typescript
const archived = await archiveTenant(tenant.id);
const restored = await restoreTenant(archived.id, 'newsubdomain');

expect(restored.subdomain).toBe('newsubdomain');
// 'myorg' now available for other tenants
```

## Edge Case 9: Multiple Archive/Restore Cycles

**Scenario**: Archive, restore, then archive again

**Risk**: Subdomain handling confusion

**Handling**:
- Each archive generates new archived subdomain with date
- Restore always returns to disabled state
- Can repeat cycle safely

**Test**:
```typescript
const tenant = await createTenant({ subdomain: 'test' });
await archiveTenant(tenant.id); // 'archived_test_20260515'
await restoreTenant(tenant.id); // 'test'
await archiveTenant(tenant.id); // 'archived_test_20260516'
await restoreTenant(tenant.id); // 'test'
```

## Edge Case 10: Empty Restore Subdomain

**Scenario**: Restore called with empty string subdomain

**Risk**: Restoration fails incorrectly

**Handling**:
- Empty string treated as "use original"
- If original taken, error thrown

**Test**:
```typescript
await archiveTenant(tenant.id);
await createTenant({ subdomain: tenant.subdomain }); // Take original

// Empty string should try original, fail, ask for new
await expect(restoreTenant(tenant.id, '')).rejects.toThrow('subdomain is already in use');
```

## Edge Case 11: Concurrent Archive Requests

**Scenario**: Two requests to archive same tenant simultaneously

**Risk**: Race condition, inconsistent state

**Handling**:
- Database operations are atomic
- Second request sees updated status and fails

**Test**:
```typescript
const promise1 = archiveTenant(tenant.id);
const promise2 = archiveTenant(tenant.id);

await expect(promise2).rejects.toThrow('Tenant is already archived');
```

## Edge Case 12: Restore Non-Existent Tenant

**Scenario**: Attempt to restore deleted tenant

**Risk**: Error handling

**Handling**:
- Service validates tenant exists
- Clear error message

**Test**:
await expect(restoreTenant('non-existent-id')).rejects.toThrow('Tenant not found');```