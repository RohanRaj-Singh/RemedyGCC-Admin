# Scanner-Attribute Template Decoupling

## Overview

This document describes the architectural changes made to decouple Scanner from Attribute Template in the RemedyGCC platform.

## Previous Architecture (Incorrect)

```text
Scanner → Attribute Template
```

In the previous design, Scanners were tightly coupled to Attribute Templates. A Scanner version contained:
- `attributeTemplateId`
- `attributeTemplateName`
- `attributeTemplateSnapshot`

This was problematic because:
1. Scanners were not truly reusable across tenants
2. Attribute Templates could not be freely paired with different Scanners
3. The ownership model was inverted - Scanner "owned" demographic structure

## New Architecture (Canonical)

```text
Tenant → Scanner
Tenant → Attribute Template
Tenant → Branding
```

In the new design:
- Scanner is a pure assessment builder containing only: categories, subdomains, questions, answers, follow-ups, weights
- Attribute Template is a standalone demographic hierarchy containing: streams, locations, functions, departments, demographics
- Tenant becomes the composition root, independently selecting Scanner, Attribute Template, and Branding
- Publishing freezes all three independently into runtime snapshots

## Changes Made

### Scanner Module

**Types** (`src/modules/scanner/types.ts`):
- Removed `attributeTemplateId`, `attributeTemplateName`, `attributeTemplateSnapshot` from `ScannerVersion`
- Removed `attributeTemplateId`, `attributeTemplateName` from `Scanner`
- Removed `attributeTemplateId` from `CreateScannerDto` and `SaveScannerDraftDto`

**Service** (`src/modules/scanner/service.ts`):
- Removed attribute template resolution from `createVersion()`, `createScanner()`, `saveScannerDraft()`
- `getTemplates()` and `getTemplateById()` now return empty/null (no longer used by scanner)
- Updated `validateDraft()` to not pass attribute template to validation

**Validation** (`src/modules/scanner/utils/validation.ts`):
- Removed `validateAttributeTemplate()` function
- Updated `validateScannerDraft()` to accept but ignore attribute template parameter
- Scanner validation is now pure - it validates only scanner structure, not demographics

**UI** (`src/modules/scanner/components/ScannerForm.tsx`):
- Removed attribute template selector from Step 0 (Basic Info)
- Scanner is now just a name/description + assessment structure builder

### Publishing Engine

**Engine** (`src/modules/publishing/engine.ts`):
- Removed `sourceScanner.version.attributeTemplateId` references
- Updated `toScannerDraftPayload()` to not include attribute template ID
- Removed obsolete check for scanner-referencing-missing-attribute-template

### Tenant Composition

**Tenant Service** (`src/modules/tenant/service.ts`):
- Already correctly handles scanner and attribute template independently via `draftScannerId` and `draftAttributeTemplateId`
- No changes needed - tenant already selects both independently
- `resolvePublishingSource()` gets scanner from `draftScannerId` and template from `draftAttributeTemplateId`

## Runtime Implications

During publishing, the Tenant now provides:
1. `sourceScanner` - the selected Scanner with its version
2. `sourceAttributeTemplate` - the selected Attribute Template
3. `branding` - the tenant's branding configuration

These three are frozen independently into the runtime config snapshot:
- `runtimeConfig.scannerVersion` - frozen scanner structure
- `runtimeConfig.attributeTemplate` - frozen demographic hierarchy
- `runtimeConfig.branding` - frozen branding

## Publish Implications

The publish flow now validates:
1. Tenant has a `draftScannerId` selected
2. Tenant has a `draftAttributeTemplateId` selected
3. Tenant has valid `branding` configuration

The scanner no longer "expects" a specific attribute template - any scanner can be paired with any attribute template at the tenant's discretion.

## Backward Compatibility

This is a breaking change for:
- Existing Scanner documents in MongoDB (they have attributeTemplateId fields that are now ignored)
- Runtime configs that were published with the old model

Migration strategy:
- Existing published scanners remain valid (attribute template data is ignored during runtime)
- New scanners are created without attribute template coupling
- Runtime configs continue to work with both old and new scanner versions