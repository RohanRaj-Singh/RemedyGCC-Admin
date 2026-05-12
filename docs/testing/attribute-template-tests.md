# Attribute Template Tests

## Verified Contract

The published attribute template contract is:

`Stream -> Location -> Function -> Department`

## Runtime Export Assertions

- `streams[]` exports root options only.
- `locations[]` export direct `streamId` references.
- `functions[]` export direct `locationId` references.
- `departments[]` export direct `functionId` references.
- No exported shortcut arrays are allowed.

## Validation Assertions

- Invalid parent references are blocked before publish.
- Incomplete branches are blocked before publish.
- Duplicate labels are checked inside direct-parent scope.
- At least one complete canonical branch is required.

## Reset Assertions

- Stream changes clear downstream location, function, and department state.
- Location changes clear downstream function and department state.
- Function changes clear downstream department state.
