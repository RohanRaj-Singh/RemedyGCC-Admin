# Attribute Hierarchy Flow

## Final Canonical Hierarchy

The Super Admin attribute template system uses one dependency chain only:

`Stream -> Location -> Function -> Department`

This order is mandatory across draft editing, validation, publishing, Mongo snapshots, and runtime exports.

## Dependency Logic

- `Stream` filters `Location` only.
- `Location` filters `Function` only.
- `Function` filters `Department` only.
- No level may skip over its direct child.
- No level may filter backward or sideways.

## Cascading Resets

Parent changes must reset every dependent level below them:

- changing `Stream` resets `Location`, `Function`, and `Department`
- changing `Location` resets `Function` and `Department`
- changing `Function` resets `Department`

This prevents stale selections, orphan branches, and invalid publish payloads.

## Runtime Expectations

Published runtime snapshots must expose the hierarchy with direct parent references only:

- location -> `streamId`
- function -> `locationId`
- department -> `functionId`

Runtime consumers are expected to build dependent dropdowns in the same order as the Super Admin builder.

## Dashboard Implications

Dashboard segmentation must resolve labels from the frozen published attribute template snapshot and must preserve the same linear chain:

- stream-level segmentation unlocks locations
- location-level segmentation unlocks functions
- function-level segmentation unlocks departments

The dashboard must not assume hidden stream-to-function or stream-to-department shortcuts.
