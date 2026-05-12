# Attribute Flow Tests

## Scope

This test matrix covers the canonical Super Admin attribute hierarchy:

`Stream -> Location -> Function -> Department`

Relevant implementation files:

- `src/modules/attribute-template/types.ts`
- `src/modules/attribute-template/utils.ts`
- `src/modules/attribute-template/components/TemplateForm.tsx`
- `src/modules/scanner/utils/validation.ts`
- `src/modules/publishing/engine.ts`
- `src/types/runtime-config.ts`

## Cascading Filter Tests

- Create a template with one stream, two locations, two functions, and two departments. Verify each level appears only under its direct parent.
- Verify selecting a stream exposes only linked locations.
- Verify selecting a location exposes only linked functions.
- Verify selecting a function exposes only linked departments.
- Verify no stream change directly exposes or hides functions or departments without passing through the intermediate levels.

## Dependency Reset Tests

- Change a stream and verify invalid locations, functions, and departments are pruned immediately.
- Change a location and verify invalid functions and departments are pruned immediately.
- Change a function and verify invalid departments are pruned immediately.
- Delete a parent option and verify every descendant branch disappears from draft state before save.

## Runtime Export Tests

- Publish a valid template and verify the runtime snapshot exports:
  - `locations[].streamId`
  - `functions[].locationId`
  - `departments[].functionId`
- Verify the runtime snapshot does not export shortcut fields such as `streamIds`, `locationIds`, `functionIds`, or `departmentIds`.
- Verify the exported arrays preserve canonical order: streams, then locations, then functions, then departments.

## Mongo Persistence Tests

- Save a draft template and verify the stored draft shape keeps explicit parent IDs on locations, functions, and departments.
- Publish the tenant and verify the frozen `attributeTemplateVersions` snapshot matches the canonical runtime contract.
- Verify a later draft edit does not mutate an already published attribute template version.

## Validation Tests

- Block save when a location references a missing stream.
- Block save when a function references a missing location.
- Block save when a department references a missing function.
- Block save when a stream has no locations.
- Block save when a location has no functions.
- Block save when a function has no departments.
- Block save when duplicate labels exist inside the same parent scope.
- Allow repeated labels only when they live under different direct parents.
