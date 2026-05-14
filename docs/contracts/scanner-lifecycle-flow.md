# Scanner Lifecycle Flow

## State Diagram

```
                    ┌─────────┐
                    │  DRAFT  │
                    └────┬────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │PUBLISHED│   │PUBLISHED│   │PUBLISHED│
    │(v2)     │   │(v3)     │   │(v1)     │
    └────┬─────┘   └────┬─────┘   └────┬─────┘
         │              │              │
         │         ┌────┴────┐         │
         ▼         ▼         ▼         ▼
    ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐
    │ ACTIVE │ │ACTIVE │ │ACTIVE │ │ACTIVE │
    └────┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
         │         │         │         │
         ▼         ▼         ▼         ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ARCHIVED │ │ARCHIVED │ │ARCHIVED │ │ARCHIVED │
    └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

## Flow 1: Create New Scanner

```
User clicks "Create Scanner"
         │
         ▼
System creates scanner root with v1 in draft
         │
         ▼
User fills in name/description (Step 0)
         │
         ▼
User builds structure (Step 1)
         │
         ▼
User adds questions (Step 2)
         │
         ▼
User assigns weights (Step 3)
         │
         ▼
User reviews and clicks "Publish"
         │
         ▼
Validation passes → v1 becomes "published"
         │
         ▼
(Optional) User clicks "Activate" → v1 becomes "active"
         │
         ▼
Scanner ready for runtime use
```

## Flow 2: Edit Published Scanner

```
User views published scanner
         │
         ▼
User clicks "Edit Scanner" or "Create New Version"
         │
         ▼
System clones latest published version content
         │
         ▼
Creates new draft version (v2)
         │
         ▼
User edits content in editor
         │
         ▼
User saves draft (can do multiple times)
         │
         ▼
User clicks "Publish"
         │
         ▼
Validation passes → v2 becomes "published"
         │
         ▼
v1 becomes "inactive" automatically
         │
         ▼
(Optional) User clicks "Activate v2" → v2 becomes "active"
```

## Flow 3: Activate Different Version

```
User with multiple published versions
         │
         ▼
User views version history
         │
         ▼
User clicks "Activate" on an older version
         │
         ▼
System deactivates current active version
         │
         ▼
System activates selected version
         │
         ▼
Runtime now uses selected version
```

## Flow 4: Archive Version

```
User views version history
         │
         ▼
User clicks "Archive" on a published (non-active) version
         │
         ▼
System verifies version is not active
         │
         ▼
System changes version status to "archived"
         │
         ▼
Version preserved for historical reference
```

## Flow 5: Duplicate Scanner (Replicate)

```
User views scanner list
         │
         ▼
User clicks "Duplicate" or "Replicate"
         │
         ▼
User provides new name and optional description
         │
         ▼
System clones all content from source scanner
         │
         ▼
Creates NEW scanner root with v1 in draft
         │
         ▼
New scanner appears in list
         │
         ▼
User can edit and publish independently
```

This is DIFFERENT from versioning:
- Versioning = same scanner, new version
- Duplication = new scanner, copied content

## Flow 6: Unsaved Changes Protection

```
User is editing scanner draft
         │
         ▼
User attempts to:
- Navigate away
- Click browser back
- Close browser tab
         │
         ▼
System detects unsaved changes
         │
         ▼
Shows dialog:
┌────────────────────────────────────────┐
│  You have unsaved changes.            │
│                                        │
│  [Cancel] [Discard] [Save Draft]       │
└────────────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
Save and   Discard
continue   and leave
```

## Flow 7: Safe Publish with Draft

```
User has draft version (v2)
         │
         ▼
User clicks "Publish"
         │
         ▼
System validates scanner structure
         │
         ▼
If invalid → show validation errors
         │
         ▼
If valid → v2 becomes "published"
         │
         ▼
Old v1 remains as "published" (now inactive)
         │
         ▼
If user had clicked "Activate" during publish:
- v2 becomes "active"
- runtime uses v2
```

## State Transition Rules

| From | To | Allowed | Condition |
|------|-----|---------|-----------|
| draft | published | Yes | Valid scanner structure |
| draft | archived | No | Cannot archive draft |
| published | active | Yes | Must be published |
| active | inactive | Automatic | When another version activated |
| active | archived | No | Must deactivate first |
| published | archived | Yes | If not active |
| archived | published | No | Cannot unarchive |
| archived | active | No | Cannot activate archived |

## Important Rules

1. **Only one draft per scanner**: Creating new version fails if draft exists
2. **Published versions are immutable**: Never edited directly
3. **Active version cannot be archived**: Must deactivate first
4. **Duplication creates new root**: Not part of version lineage
5. **Unsaved changes protected**: Browser navigation blocked with dialog

## Runtime Behavior

- Runtime uses `activeVersionId` to resolve which scanner version to serve
- If no active version, fall back to latest published version
- Submissions reference specific version ID, preserving historical accuracy