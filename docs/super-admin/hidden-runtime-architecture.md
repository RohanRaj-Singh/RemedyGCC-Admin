# Hidden Runtime Architecture

## Purpose

The tenant module now presents a business-facing workflow while preserving the existing runtime-safe architecture underneath.

Business users do not need to understand immutable runtime publishing in order to operate the tenant workflow safely.

## Internal Architecture That Remains

The backend still uses:

- immutable `runtimeConfigs`
- immutable tenant-scoped `scannerVersions`
- immutable tenant-scoped `attributeTemplateVersions`
- tenant `activeRuntimeConfigId`
- explicit publish and activation flow
- historical submission preservation through published runtime references

None of that architecture was removed during the UX simplification pass.

## Why Runtime Configs Still Exist

`runtimeConfigs` remain required because the runtime app and response pipeline need a frozen survey definition containing:

- tenant identity
- branding payload
- scanner version snapshot
- attribute template snapshot
- calculation version reference
- publish timestamps

This snapshot guarantees that live respondents and historical submissions always resolve against the exact survey definition that was published.

## Why Immutable Snapshots Still Matter

Immutable publishing protects the platform from silent drift:

- draft changes do not mutate the live survey directly
- previously collected submissions keep their original survey context
- reactivation can safely point back to an older published survey
- audit and support flows can inspect historical survey states

## What Is Hidden From Primary UX

The primary tenant screens no longer lead with:

- raw runtime config IDs
- branding version IDs
- calculation version IDs
- attribute template version IDs
- low-level snapshot terminology

Instead, business users see:

- scanner
- attribute template
- branding
- publish status
- live survey state
- safe actions

## Where Technical Details Still Live

Advanced implementation details remain available behind collapsible `Technical Details` sections.

This keeps:

- support workflows intact
- developer debugging possible
- Mongo and runtime contracts transparent when needed

while preventing internal architecture terms from dominating normal business workflows.

## UX Rule

The business UI should describe outcomes:

- publish survey
- make survey live
- disable survey
- archive tenant

The backend and technical docs continue to enforce the real architecture:

- publish immutable snapshot
- activate tenant runtime pointer
- preserve version history
- preserve submission stability
