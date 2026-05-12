# Attribute Module Tests

This module now follows the canonical attribute flow documented in:

- `docs/testing/attribute-flow-tests.md`
- `docs/testing/attribute-flow-edge-cases.md`

## Core Assertions

- The only supported hierarchy is `Stream -> Location -> Function -> Department`.
- Every dependent option must keep an explicit direct-parent reference.
- Parent edits must prune every invalid descendant before save and before publish.
- Published runtime snapshots must preserve the same direct-parent chain without shortcut arrays.
