# Attribute Publishing Boundaries

## Attribute Ownership

- Draft attribute templates may change freely inside Super Admin.
- Published attribute template versions are immutable runtime artifacts.

## Publishing Responsibilities

When a tenant publish action freezes an attribute template:

- the draft must already satisfy `Stream -> Location -> Function -> Department`
- the system must validate direct parent references at every level
- the system must reject orphan or incomplete branches
- the system must write a deep immutable snapshot into `attributeTemplateVersions`

## Runtime Responsibilities

Runtime consumers must read the frozen hierarchy exactly as published:

- locations by `streamId`
- functions by `locationId`
- departments by `functionId`

Runtime code must not infer shortcut relationships that were never published.

## Dashboard Responsibilities

Dashboard filters and segmentation must resolve labels from the same immutable snapshot and preserve the same linear dependency chain.
