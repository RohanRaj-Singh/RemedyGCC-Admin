# Tenant Composition Architecture

## Canonical Ownership Model

The Tenant is the composition root for runtime configuration. Each Tenant independently owns:

```text
Tenant → Scanner
Tenant → Attribute Template
Tenant → Branding
```

These three components are orthogonal and independently selectable.

## Component Responsibilities

### Scanner

A Scanner is a pure assessment builder that contains:
- **Categories**: 5 fixed slots (slot 1-5)
- **Subdomains**: hierarchical organization within categories
- **Questions**: multiple-choice questions within subdomains
- **Answers**: options with scores for each question
- **Follow-ups**: conditional diagnostic questions triggered by primary question answers
- **Weights**: numeric weights at category, subdomain, and question levels

A Scanner is **fully reusable** across:
- Multiple tenants
- Multiple organizations
- Multiple runtime configurations

A Scanner must **NEVER** own demographic structure assumptions.

### Attribute Template

An Attribute Template is a demographic hierarchy that contains:
- **Streams**: top-level organizational units
- **Locations**: physical or logical locations belonging to streams
- **Functions**: departments or functions belonging to locations
- **Departments**: sub-departments belonging to functions
- **Demographics**: gender, age groups, seniority levels

An Attribute Template is **fully reusable** across:
- Multiple tenants
- Multiple scanners
- Multiple runtime configurations

An Attribute Template must **NEVER** belong to a scanner.

### Branding

Branding contains visual identity configuration:
- App name
- Logo URL
- Primary/secondary colors
- Favicon
- Gradient settings

Branding is **fully reusable** across tenants.

## Tenant Document Model

```typescript
interface TenantDocument {
  tenantId: string;
  name: string;
  slug: string;
  subdomain: string;
  status: 'draft' | 'active' | 'disabled' | 'archived';

  // Composition references
  draftScannerId: string | null;
  draftAttributeTemplateId: string | null;

  // Runtime state
  activeRuntimeConfigId: string | null;
  branding: BrandingConfig;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

## Publishing Flow

When a tenant publishes a runtime configuration:

1. **Selection Phase** (Tenant Setup):
   - Tenant selects a Scanner (via `draftScannerId`)
   - Tenant selects an Attribute Template (via `draftAttributeTemplateId`)
   - Tenant configures Branding

2. **Validation Phase**:
   - Validate scanner structure is complete (5 categories, weights sum to 100)
   - Validate attribute template hierarchy is complete (streams → locations → functions → departments)
   - Validate branding configuration

3. **Freezing Phase** (Runtime Config Generation):
   - Create stable UUIDs for all question IDs (stable across publishes)
   - Create runtime attribute template with stable IDs
   - Generate fingerprints for version tracking

4. **Persistence Phase**:
   - Store `ScannerVersion` document (frozen scanner snapshot)
   - Store `AttributeTemplateVersion` document (frozen demographic snapshot)
   - Store `RuntimeConfig` document (complete runtime configuration)

## Runtime Config Structure

```typescript
interface TenantRuntimeConfigSnapshot {
  runtimeConfigId: string;
  tenant: RuntimeTenantSummary;
  versionRefs: RuntimeVersionRefs;
  branding: BrandingConfig;
  attributeTemplate: RuntimeAttributeTemplate;
  scannerVersion: RuntimeScannerVersion;
  runtimeSettings: RuntimeSettings;
}
```

The `versionRefs` contains:
```typescript
interface RuntimeVersionRefs {
  scannerVersionId: string;
  attributeTemplateVersionId: string;
  calculationVersionId: string;
  brandingVersionId: string;
}
```

## Multi-Tenant Reusability

### Scanner Reusability

A single Scanner can be used by multiple tenants:
- Tenant A publishes with Scanner v1 + Attribute Template X
- Tenant B publishes with Scanner v1 + Attribute Template Y

The scanner version is frozen at publish time, so each tenant gets its own immutable snapshot.

### Attribute Template Reusability

A single Attribute Template can be used by multiple scanners:
- Tenant A publishes with Scanner v1 + Attribute Template X
- Tenant B publishes with Scanner v2 + Attribute Template X

The attribute template version is frozen at publish time.

### Version Reuse Optimization

When publishing, the system checks for existing versions with matching fingerprints:
- If scanner content matches a previous version, reuse the same `scannerVersionId`
- If attribute template matches a previous version, reuse the same `attributeTemplateVersionId`
- This enables efficient storage when the same content is published multiple times

## Validation Boundaries

### Scanner Validation (Admin Side)
- Name and description in both languages
- Exactly 5 categories
- Categories weights sum to 100
- Subdomains have at least one question
- Question weights sum to subdomain weight
- Follow-up triggers reference valid questions

### Tenant Publishing Validation
- Tenant has a scanner selected (`draftScannerId`)
- Tenant has an attribute template selected (`draftAttributeTemplateId`)
- Tenant has valid branding
- Scanner version is valid
- Attribute template version is valid

### Runtime Validation
- Scanner has at least one category
- Scanner has valid question structure
- Attribute template has at least one stream with complete hierarchy
- All referenced IDs are stable and consistent