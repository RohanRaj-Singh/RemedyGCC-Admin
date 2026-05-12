# Tenant Runtime Behavior

## Tenant Lifecycle

The canonical tenant lifecycle is:

`draft -> active -> disabled -> archived`

Rules:

- `draft`
  private setup only, not available to the runtime
- `active`
  one published configuration is linked and available to respondents
- `disabled`
  published history remains stored, but live survey access is blocked
- `archived`
  historical record only, protected from direct mutation

## Runtime Linkage

The tenant owns only the live pointer:

```text
tenant
-> activeRuntimeConfigId
-> runtimeConfigId
-> scannerVersionId
-> attributeTemplateVersionId
-> calculationVersionId
-> brandingVersionId
```

The tenant module also keeps draft setup references for the next publish:

- `draftScannerId`
- `draftAttributeTemplateId`
- draft branding input

These draft links do not mutate the active runtime in place.

## Publish Flow

Safe flow:

```text
update draft setup
-> preview published configuration
-> publish immutable runtime config
-> activate published configuration
```

Unsafe flow that is blocked:

```text
edit active runtime config directly
```

Publish writes:

- one immutable `runtimeConfigs` record
- one immutable `scannerVersions` record for the tenant
- one immutable `attributeTemplateVersions` record for the tenant

## Activation Rules

- activation is explicit and tenant-scoped
- only published configurations belonging to the same tenant may be activated
- activating a configuration moves the tenant pointer and updates the active marker
- archived tenants cannot activate or publish
- draft or disabled tenants can become active only through a valid published configuration

## Runtime Safety Guarantees

- slug and subdomain become immutable once runtime history or submissions exist
- live submissions are counted from `rawResponses`
- live survey history is preserved through `runtimeConfigId`
- deleting tenants with submissions or published history is blocked
- branding or setup changes after publish create pending publish state instead of silently changing the live survey
