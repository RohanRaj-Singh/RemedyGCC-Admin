# Tenant Module Tests

## Source of Truth

- `docs/contracts/api/runtime-config-api.md`
- `docs/contracts/immutable-versioning-strategy.md`
- `docs/database/database-preparation.md`
- `docs/runtime/branding-system.md`

## Slug Validation Tests

| Scenario | Input | Expected Result |
| --- | --- | --- |
| valid slug | `acme-health` | accepted |
| uppercase input | `Acme Health` | normalized to `acme-health` before save |
| spaces and underscores | `acme_health clinic` | normalized to `acme-health-clinic` |
| reserved slug | `admin` | rejected |
| special characters | `acme!@#` | rejected after normalization if empty or invalid |
| leading or trailing hyphen | `-acme-` | normalized to `acme` |
| duplicate slug | existing tenant slug reused | rejected |
| over 63 chars | DNS label overflow | rejected |

## Branding Validation Tests

| Scenario | Input | Expected Result |
| --- | --- | --- |
| full runtime branding | app name, logo, primary, secondary, favicon, gradients | accepted with no warnings |
| partial branding | missing secondary, favicon, or font | accepted with fallback warnings |
| invalid primary color | non-hex value | rejected |
| invalid secondary color | non-hex value | rejected |
| invalid logo path | unsupported URL scheme | rejected |
| invalid favicon path | unsupported URL scheme | rejected |
| blank branding object | `{}` | accepted with runtime fallback warnings |

## Runtime Config Linking Tests

| Scenario | Input | Expected Result |
| --- | --- | --- |
| active tenant with published runtime config | `status=active` + published `activeRuntimeConfigId` | accepted |
| active tenant without runtime config | `status=active` + `activeRuntimeConfigId=null` | rejected |
| cross-tenant runtime config | runtime config belongs to another tenant | rejected |
| draft runtime config selected as active | runtime config status is `draft` | rejected |
| archived runtime config selected as active | runtime config status is `archived` | rejected |
| published runtime config activated | `activeRuntimeConfigId` updated to published snapshot | accepted and tenant points to immutable version refs |

## Tenant Isolation Tests

| Scenario | Query or Action | Expected Result |
| --- | --- | --- |
| list tenant runtime configs | fetch runtime configs by `tenantId` | only matching tenant configs returned |
| activate runtime config | set `activeRuntimeConfigId` | selected config must belong to same tenant |
| slug lookup | fetch tenant by slug | returns only one exact tenant |
| search/filter in admin | search by name, slug, runtime config id | tenant list only, no runtime cross-link leakage |
| delete tenant | delete request against non-draft or linked tenant | rejected to protect immutable references |

## Status Flow Tests

| Scenario | Input | Expected Result |
| --- | --- | --- |
| create draft tenant | no runtime config linked | accepted |
| activate draft tenant | published runtime config linked | accepted |
| disable active tenant | `status=disabled` | tenant remains stored but runtime resolution must be blocked |
| archive tenant | `status=archived` | tenant becomes protected and historical-only |
| edit archived tenant | modify name, slug, branding, or runtime config | rejected |
| change slug after publish | published runtime config already linked | rejected |

## Publish Preparation Tests

| Scenario | State | Expected Result |
| --- | --- | --- |
| draft edits after publish | name, slug, or branding changed | `hasPendingChanges=true` |
| activate published snapshot | only `activeRuntimeConfigId` changed | pending changes cleared |
| branding change on active tenant | branding edited after activation | runtime fallback still safe and publish warning shown |
