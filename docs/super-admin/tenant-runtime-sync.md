# Tenant Runtime Sync

## Source of Truth

- `docs/contracts/api/runtime-config-api.md`
- `docs/contracts/immutable-versioning-strategy.md`
- `docs/contracts/super-admin-response-sync.md`
- `docs/database/database-preparation.md`
- `docs/runtime/branding-system.md`

## Tenant Responsibilities

- own tenant identity:
  `id`, `slug`, `name`, `status`, `createdAt`, `updatedAt`
- own draft branding input used for future publish operations
- hold the active runtime pointer in `activeRuntimeConfigId`
- enforce slug uniqueness and DNS-safe normalization
- block unsafe status transitions such as `active` without a published runtime config

## Runtime Responsibilities

- resolve tenant by `slug`
- reject missing, disabled, or otherwise non-runnable tenants before public render
- serve only the active immutable runtime snapshot
- consume the branding payload and version refs from the published runtime config

## Runtime Config Linking Behavior

Tenant linking is canonical only in this direction:

```text
tenant
-> activeRuntimeConfigId
-> runtimeConfigId
-> scannerVersionId
-> attributeTemplateVersionId
-> calculationVersionId
-> brandingVersionId
```

The tenant module must not:

- attach scanner trees directly to the tenant
- attach attribute-template trees directly to the tenant
- mutate published version refs inside an active runtime config

## Immutable Snapshot Expectations

- `runtimeConfigId` is the public runtime composition pointer
- changing tenant branding or tenant identity after publish creates draft changes, not in-place runtime mutation
- historical runtime configs remain readable after supersession
- the active tenant pointer may move, but previously published runtime configs stay valid for audits and historical response lookup

## Tenant Status Expectations

- `draft`
  private tenant record, not publicly resolvable
- `active`
  resolvable only when linked to a published runtime config
- `disabled`
  runtime resolution blocked while preserving history
- `archived`
  historical tenant retained for immutable references and protected from direct mutation
