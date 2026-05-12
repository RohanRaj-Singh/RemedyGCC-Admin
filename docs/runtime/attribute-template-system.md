# Attribute Template System

## Source Files

- `src/modules/attribute-template/types.ts`
- `src/modules/attribute-template/utils.ts`
- `src/modules/attribute-template/service.ts`
- `src/modules/attribute-template/components/TemplateForm.tsx`
- `src/modules/scanner/utils/validation.ts`
- `src/modules/publishing/engine.ts`
- `src/types/runtime-config.ts`

## Canonical Hierarchy

The published attribute hierarchy is strictly linear:

`Stream -> Location -> Function -> Department`

Rules:

- `Stream` filters `Location` only.
- `Location` filters `Function` only.
- `Function` filters `Department` only.
- Cross-hierarchy shortcuts are not allowed.
- Reverse filtering is not allowed.
- Circular or multi-parent dependencies are not allowed.

## Draft Authoring Contract

Super Admin drafts store explicit parent references on every dependent level:

```ts
stream: Array<{ id: string; label: string }>;
location: Array<{ id: string; label: string; streamId: string }>;
function: Array<{ id: string; label: string; locationId: string }>;
department: Array<{ id: string; label: string; functionId: string }>;
```

`src/modules/attribute-template/utils.ts` is the canonical source for:

- hierarchy normalization
- stable scoped ID generation
- parent-child map building
- duplicate label checks
- orphan reference detection
- incomplete branch detection
- cascade pruning after parent changes

## Builder Behavior

`TemplateForm` enforces the hierarchy visually and behaviorally:

- streams are created first
- locations can only be created under an existing stream
- functions can only be created under an existing location
- departments can only be created under an existing function

Cascading reset behavior:

- changing `Stream` prunes invalid `Location`, `Function`, and `Department` selections
- changing `Location` prunes invalid `Function` and `Department` selections
- changing `Function` prunes invalid `Department` selections

## Published Runtime Contract

Publishing exports the same hierarchy into the immutable runtime snapshot:

```ts
attributeTemplate: {
  streams: Array<{ id: string; label: string; value: string }>;
  locations: Array<{ id: string; label: string; value: string; streamId: string }>;
  functions: Array<{ id: string; label: string; value: string; locationId: string }>;
  departments: Array<{ id: string; label: string; value: string; functionId: string }>;
  genders?: string[];
  ageGroups?: string[];
  seniorityLevels?: string[];
  fixedAttributes?: {
    location?: { enabled?: boolean; required?: boolean; label?: string; placeholder?: string };
    gender?: { enabled?: boolean; required?: boolean; label?: string; placeholder?: string };
    age?: { enabled?: boolean; required?: boolean; label?: string; placeholder?: string };
    seniority?: { enabled?: boolean; required?: boolean; label?: string; placeholder?: string };
  };
}
```

The runtime export contains only direct parent references:

- `locations[].streamId`
- `functions[].locationId`
- `departments[].functionId`

No exported many-to-many shortcut arrays exist.

## Validation Guarantees

The validation pipeline blocks publish/save when it finds:

- orphan locations
- orphan functions
- orphan departments
- duplicate labels inside the same parent scope
- missing child branches
- broken parent references
- empty or incomplete canonical chains

Validation messages use full hierarchy context so broken branches are obvious during authoring and publish review.

## Dashboard And Runtime Expectations

Consumers must treat the attribute template as a cascading chain:

- choose `Stream`
- resolve valid `Location` options
- resolve valid `Function` options from the selected location
- resolve valid `Department` options from the selected function

Dashboard and runtime consumers should not infer hidden cross-links between streams, functions, and departments outside that chain.
