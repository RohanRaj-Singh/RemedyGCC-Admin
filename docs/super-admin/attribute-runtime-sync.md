# Attribute Runtime Synchronization

## Canonical Sync Contract

The Super Admin attribute builder and the runtime snapshot share one hierarchy only:

`Stream -> Location -> Function -> Department`

## Synchronization Rules

- Draft authoring uses direct parent references on every child level.
- Publish exports the same direct parent references into the runtime contract.
- Runtime consumers must cascade in the same order as the Super Admin builder.
- No parallel location branch or stream-to-function shortcut exists in the synchronized contract.

## Immutable Snapshot Behavior

1. Super Admin saves and validates a draft attribute template.
2. Tenant publishing freezes the validated draft into an immutable attribute template version.
3. Runtime reads only the frozen version until a new publish replaces the active snapshot.

## Runtime Expectations

- a location with an unknown `streamId` is invalid
- a function with an unknown `locationId` is invalid
- a department with an unknown `functionId` is invalid
- missing downstream branches should block publish instead of relying on runtime recovery
