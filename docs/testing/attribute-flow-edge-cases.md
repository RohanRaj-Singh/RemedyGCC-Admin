# Attribute Flow Edge Cases

## Orphan Dependencies

- A location without a valid stream must be rejected.
- A function without a valid location must be rejected.
- A department without a valid function must be rejected.
- Publishing must stop if any orphan survives normalization.

## Stale Selections

- If a stream changes, all stale location, function, and department descendants must reset.
- If a location changes, all stale function and department descendants must reset.
- If a function changes, all stale department descendants must reset.
- No stale child selection may remain in draft state, publish payloads, or runtime exports.

## Invalid Parent References

- Reject empty parent IDs on locations, functions, and departments.
- Reject parent IDs that point to deleted or unknown options.
- Report validation messages with full hierarchy context so the broken branch is easy to locate.

## Circular Hierarchy Attempts

- A child cannot become its own ancestor through reused IDs or remapped parents.
- A department cannot point to a location or stream.
- A function cannot point directly to a stream.
- A location cannot point to a function or department.

## Duplicate Labels

- Duplicate stream labels are invalid globally.
- Duplicate location labels are invalid inside the same stream.
- Duplicate function labels are invalid inside the same location.
- Duplicate department labels are invalid inside the same function.
- The same label may exist in different branches when the direct parent differs.

## Partial Hierarchy Branches

- A stream with no locations is invalid.
- A location with no functions is invalid.
- A function with no departments is invalid.
- A template without at least one complete `Stream -> Location -> Function -> Department` chain must not publish.
