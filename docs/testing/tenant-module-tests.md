# Tenant Module Tests

## Scope

This matrix covers the completed Super Admin tenant module against the active Mongo-backed tenant registry, published runtime configuration history, and raw submission counts.

## Create Flow

| Scenario | Input | Expected Result |
| --- | --- | --- |
| create draft tenant | valid `name`, `slug`, `subdomain`, optional branding, no live survey config | tenant is stored in `tenants` with `status=draft` |
| create tenant with scanner and template linked | valid draft setup ids plus draft branding | tenant saves successfully and remains `draft` |
| create tenant marked active | `status=active` with no published configuration | rejected |
| create tenant with duplicate slug | slug already exists after normalization | rejected |
| create tenant with duplicate subdomain | subdomain already exists after normalization | rejected |

## Update Flow

| Scenario | Input | Expected Result |
| --- | --- | --- |
| rename draft tenant | change `name` only | accepted |
| update branding on active tenant | change branding fields only | accepted, active runtime stays unchanged, pending publish warning appears |
| connect new scanner on active tenant | change `draftScannerId` only | accepted as draft setup change, no live runtime mutation |
| connect new attribute template on active tenant | change `draftAttributeTemplateId` only | accepted as draft setup change, no live runtime mutation |
| change slug before publish | draft tenant with no runtime history | accepted after normalization and uniqueness validation |
| change slug after publish | tenant has runtime history or submissions | rejected |
| change subdomain after publish | tenant has runtime history or submissions | rejected |
| set active without published config | `status=active` while `activeRuntimeConfigId=null` | rejected |
| archive active tenant directly | `status=archived` while tenant is active | rejected until disabled first |

## Archive And Delete Flow

| Scenario | Input | Expected Result |
| --- | --- | --- |
| disable active tenant | `status=disabled` | accepted, runtime pointer preserved |
| archive disabled tenant | `status=archived` | accepted, tenant becomes read-only |
| delete draft tenant safely | `status=draft`, no runtime history, no submissions, exact slug confirmation | accepted |
| delete draft tenant with wrong confirmation | confirmation text mismatch | rejected |
| delete tenant with published config history | any runtime config exists | rejected |
| delete tenant with submissions | `rawResponses` exist for tenant | rejected |

## Runtime Safety

| Scenario | Input | Expected Result |
| --- | --- | --- |
| publish live survey config | scanner + attribute template connected, valid branding, valid tenant identity | new immutable `runtimeConfigId` written to Mongo |
| publish duplicate config | draft exactly matches an existing published config | duplicate publish blocked, existing config offered for activation |
| activate published config | runtime config belongs to same tenant | tenant `activeRuntimeConfigId` updated and target runtime marked active |
| activate config from another tenant | cross-tenant runtime id | rejected |
| publish with scanner/template mismatch | selected scanner references a different template | rejected |
| active branding edit after publish | branding updated without new publish | live runtime preserved, pending publish state shown |

## Slug And Subdomain Validation

| Scenario | Input | Expected Result |
| --- | --- | --- |
| uppercase slug | `Acme Health` | normalized to `acme-health` |
| uppercase subdomain | `North Hub` | normalized to `north-hub` |
| reserved slug | `admin` | rejected |
| reserved subdomain | `www` | rejected |
| invalid special characters | `acme!@#` | normalized or rejected if invalid/empty |
| label too long | more than 63 chars | rejected |
| leading and trailing hyphens | `-acme-` | normalized to `acme` |

## Mongo Integration

| Scenario | Query Or Action | Expected Result |
| --- | --- | --- |
| list tenants | `GET /api/super-admin/tenants` | reads from `tenants` collection, not in-memory state |
| tenant details | `GET /api/super-admin/tenants/:id` | merges tenant record, runtime history, and submission counts |
| runtime history list | `GET /api/super-admin/tenants/:id/runtime-configs` | returns only same-tenant published configs |
| publish config | `POST /api/super-admin/tenants/:id/publish` | writes `runtimeConfigs`, `scannerVersions`, and `attributeTemplateVersions` |
| submission count display | detail page load | counts `rawResponses` by `tenantId` and `runtimeConfigId` |
| tenant stats | `GET /api/super-admin/tenants/stats` | aggregates tenant statuses from Mongo and submission totals from `rawResponses` |
