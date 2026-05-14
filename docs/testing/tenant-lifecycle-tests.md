# Tenant Lifecycle Tests

## Archive Tests

### Test: Archive Disabled Tenant
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await publishTenantRuntime(tenant.id, { activate: false });
const updated = await updateTenant(tenant.id, { status: 'disabled' });

const archived = await archiveTenant(updated.id);

expect(archived.status).toBe('archived');
expect(archived.subdomain).toMatch(/^archived_test_/);
expect(archived.archivedAt).toBeDefined();
```

### Test: Archive Active Tenant
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await publishTenantRuntime(tenant.id, { activate: true });

const archived = await archiveTenant(tenant.id);

expect(archived.status).toBe('archived');
expect(archived.subdomain).toMatch(/^archived_test_/);
```

### Test: Cannot Archive Already Archived
```typescript
const tenant = await archiveTenant(tenantId);

await expect(archiveTenant(tenant.id)).rejects.toThrow('Tenant is already archived');
```

### Test: Archive Releases Subdomain
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await archiveTenant(tenant.id);

// Original subdomain should now be available
const newTenant = await createTenant({ 
  name: 'New', 
  slug: 'new', 
  subdomain: 'test' // Should succeed
});

expect(newTenant.subdomain).toBe('test');
```

## Restore Tests

### Test: Restore Archived Tenant
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await archiveTenant(tenant.id);

const restored = await restoreTenant(tenant.id);

expect(restored.status).toBe('disabled');
expect(restored.subdomain).toBe('test');
expect(restored.archivedAt).toBeNull();
```

### Test: Restore with New Subdomain
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await archiveTenant(tenant.id);

// Create another tenant with same subdomain first
await createTenant({ name: 'Taken', slug: 'taken', subdomain: 'test' });

// Restore with new subdomain
const restored = await restoreTenant(tenant.id, 'newsubdomain');

expect(restored.status).toBe('disabled');
expect(restored.subdomain).toBe('newsubdomain');
```

### Test: Restore Fails if Subdomain Taken and No Alternative Given
```typescript
const tenant1 = await createTenant({ name: 'Test1', slug: 'test1', subdomain: 'test' });
await archiveTenant(tenant1.id);

const tenant2 = await createTenant({ name: 'Test2', slug: 'test2', subdomain: 'test' });

// Try to restore without providing new subdomain
await expect(restoreTenant(tenant1.id)).rejects.toThrow('subdomain is already in use');
```

### Test: Can Only Restore Archived Tenant
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });

await expect(restoreTenant(tenant.id)).rejects.toThrow('Only archived tenants can be restored');
```

## Delete Tests

### Test: Delete Draft Tenant
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });

await deleteTenant(tenant.id, 'test');

const fetched = await getTenantById(tenant.id);
expect(fetched).toBeNull();
```

### Test: Cannot Delete Tenant with Submissions
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await publishTenantRuntime(tenant.id, { activate: true });
await submitResponse(tenant.id, { ... });

await expect(deleteTenant(tenant.id, 'test')).rejects.toThrow('Only draft tenants without submissions');
```

### Test: Cannot Delete Tenant with Runtime History
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await publishTenantRuntime(tenant.id, { activate: false });

await expect(deleteTenant(tenant.id, 'test')).rejects.toThrow('Only draft tenants without submissions');
```

### Test: Delete Requires Confirmation
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });

await expect(deleteTenant(tenant.id, 'wrong-slug')).rejects.toThrow('Type the tenant slug');
```

## Subdomain Release Tests

### Test: Archived Subdomain Reusable
```typescript
const tenant1 = await createTenant({ name: 'Test1', slug: 'test1', subdomain: 'myorg' });
await archiveTenant(tenant1.id);

const tenant2 = await createTenant({ name: 'Test2', slug: 'test2', subdomain: 'myorg' });

expect(tenant2.subdomain).toBe('myorg');
```

### Test: Archived Tenant Original Subdomain Preserved
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'myorg' });
await archiveTenant(tenant.id);

const restored = await restoreTenant(tenant.id, 'neworg');

expect(restored.subdomain).toBe('neworg');
// Original 'myorg' can be used by new tenants
```

## Runtime Blocking Tests

### Test: Archived Tenant Blocked
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await archiveTenant(tenant.id);

const response = await makeRequest('http://test.remedy.app');

expect(response.status).toBe(404); // Or "tenant not found"
```

### Test: Disabled Tenant Blocked
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await updateTenant(tenant.id, { status: 'disabled' });

const response = await makeRequest('http://test.remedy.app');

expect(response.status).toBe(200);
expect(response.body).toContain('Survey unavailable');
```

### Test: Active Tenant Accessible
```typescript
const tenant = await createTenant({ name: 'Test', slug: 'test', subdomain: 'test' });
await publishTenantRuntime(tenant.id, { activate: true });

const response = await makeRequest('http://test.remedy.app');

expect(response.status).toBe(200);
expect(response.body).toContain('survey');
```

## Destructive Action Confirmation Tests

### Test: Archive Requires User Confirmation
```typescript
// In UI, should show confirmation modal before archiving
const { getByText } = render(<TenantDetail tenant={tenant} />);

fireEvent.click(getByText('Archive Tenant'));

expect(getByText('Archive Tenant')).toBeInTheDocument(); // Modal appears
expect(getByText('This action is reversible')).toBeInTheDocument();
```

### Test: Delete Requires Slug Typing
```typescript
const { getByText } = render(<TenantDetail tenant={draftTenant} />);

fireEvent.click(getByText('Delete Draft Tenant'));

// Should show prompt requiring slug typing
expect(window.prompt).toHaveBeenCalledWith(
  expect.stringContaining('Type "')
);
```