# Tenant Publishing Boundaries

## Tenant Module Owns

- tenant identity fields
- tenant slug validation and hostname readiness
- tenant status lifecycle
- draft branding input
- active runtime config pointer selection
- warnings about partial branding and unpublished tenant changes

## Publishing System Owns

- validating draft scanner, attribute-template, branding, and calculation inputs for publish
- creating immutable `scannerVersionId`
- creating immutable `attributeTemplateVersionId`
- creating immutable `brandingVersionId`
- composing and freezing `runtimeConfigId`
- writing publish history and activation audit metadata

## Runtime App Consumes

- `GET /api/runtime/:tenantSlug`
- `runtimeConfigId`
- version refs:
  `scannerVersionId`, `attributeTemplateVersionId`, `calculationVersionId`, `brandingVersionId`
- branding payload already normalized or safe to normalize with runtime defaults
- immutable scanner and attribute snapshots plus the published branding payload

## Explicit Non-Ownership Rules

The tenant module must not:

- edit published scanner structures in place
- infer runtime structure from draft scanner state
- treat branding edits as live runtime changes without a new publish
- bypass runtime config linking by storing direct scanner ownership on the tenant

## Activation Boundary

- selecting `activeRuntimeConfigId` is allowed only for published runtime configs belonging to the same tenant
- activating a runtime config changes the tenant pointer, not the published snapshot
- if tenant draft data changes after activation, the module must show pending publish warnings until a new immutable runtime config is published
