# Scanner Evolution Strategy

## Overview

This document defines the NEW canonical strategy for scanner evolution, replacing heavy immutable version branching with a clear, business-friendly workflow.

## Core Principle

**The platform is tenant-centric, NOT a shared scanner ecosystem.**

Therefore:
- Scanners are rarely shared between tenants
- Major scanner evolution should primarily happen through duplication
- Heavy immutable version lineage adds complexity without business value

## Evolution Decision Tree

```
Scanner Change Request
         │
         ▼
   Has Submissions?
    │    │
   No   Yes
    │    │
    ▼    ▼
   Check Change Type
    │    │
    ├────┴────┐
    │         │
  Safe/    Breaking
Additive   Changes
    │         │
    ▼         ▼
  Direct     Duplicate
  Edit       Scanner
```

## Evolution Workflows

### Workflow 1: Minor Additive Edits (No Submissions)

**When to use**: Scanner has no responses, minor structure changes needed

**Flow**:
```
Create Scanner → Edit → Save → Publish
```

**Example**:
- Add new questions during setup
- Reorder categories/subdomains
- Fix typos before going live

### Workflow 2: Additive Edits (With Submissions)

**When to use**: Scanner has responses, adding new content

**Flow**:
```
Published Scanner (5 submissions)
         │
         ▼
   Add new question
         │
         ▼
   Direct Save (allowed)
         │
         ▼
Published Scanner (5 submissions + new question in draft)
         │
         ▼
   Publish
         │
         ▼
Scanner (6+ submissions in new runtime)
```

**Example**:
- Add optional survey questions
- Add new subdomain for expansion
- Add follow-up triggers

### Workflow 3: Safe Metadata Edits (With Submissions)

**When to use**: Scanner has responses, but only text/display changes

**Flow**:
```
Published Scanner (10 submissions)
         │
         ▼
   Fix typo in question text
         │
         ▼
   Direct Save (allowed)
         │
         ▼
   Publish
```

**Example**:
- Correct spelling errors
- Update descriptions
- Improve help text

### Workflow 4: Major Redesign (With Submissions)

**When to use**: Scanner has responses, breaking changes needed

**Flow**:
```
Published Scanner (15 submissions)
         │
         ▼
   Attempt breaking change
         │
         ▼
   Breaking Change Modal
         │
         ▼
   Duplicate Scanner
         │
         ▼
   New Scanner (0 submissions)
         │
         ▼
   Make breaking changes
         │
         ▼
   Publish
         │
         ▼
New Scanner (live, independent)
```

**Example**:
- Change scoring from 1-5 to 1-10
- Restructure categories entirely
- Delete and replace questions
- Annual survey refresh

### Workflow 5: Client Customization

**When to use**: Need client-specific version of generic scanner

**Flow**:
```
Generic Healthcare Scanner
         │
         ▼
   Duplicate Scanner
         │
         ▼
   Healthcare Client A Scanner
         │
         ▼
   Customize for client
         │
         ▼
   Publish
         │
         ▼
   Assign to client tenant
```

## Change Classification Summary

| Change Type | No Submissions | Has Submissions | Workflow |
|------------|----------------|-----------------|----------|
| Fix typo | ✅ Direct | ✅ Direct | Workflow 1/2 |
| Reorder questions | ✅ Direct | ✅ Direct | Workflow 2 |
| Add question | ✅ Direct | ✅ Direct | Workflow 2 |
| Add subdomain | ✅ Direct | ✅ Direct | Workflow 2 |
| Change score | ✅ Direct | ❌ Duplicate | Workflow 4 |
| Delete question | ✅ Direct | ❌ Duplicate | Workflow 4 |
| Change weight | ✅ Direct | ❌ Duplicate | Workflow 4 |
| Remove answer | ✅ Direct | ❌ Duplicate | Workflow 4 |
| Restructure all | ✅ Direct | ❌ Duplicate | Workflow 4 |

## Version vs Duplication

### When to Create Version (Legacy - Deprioritized)

Version branching is now **secondary** and rarely needed:

1. **Very minor iterative changes**: When you want to track small changes over time
2. **A/B testing**: Compare two published versions (rarely used)
3. **Rollback preference**: When you want easy version reversion

### When to Duplicate (Primary)

Duplication is now **primary** for major changes:

1. **Major redesigns**: When structure needs significant changes
2. **Annual refreshes**: Create new year version
3. **Client customization**: Clone for specific client
4. **Breaking changes**: Any change blocked by submission protection
5. **Starting fresh**: When you want clean slate

## Practical Examples

### Example 1: Employee Wellness Annual Survey

```
2024 Survey (Published, 100 submissions)
      │
      ├─────────────────────────────────────────┐
      │                                         │
      ▼                                         ▼
Small edits (safe)                    Major restructure
      │                                         │
      ▼                                         │
Add Q6 about mental health                      ▼
      │                              Duplicate Scanner
      │                                         │
      ▼                                         ▼
Add Q7 about work-life balance           Employee Wellness 2025
      │                                         │
      │                                         ▼
      ▼                              Complete redesign
   Publish                                │
      │                                   ▼
      │                              Publish
      ▼                              │
Employee Wellness 2024                      ▼
(with 102 submissions)              Employee Wellness 2025
                                 (0 submissions, fresh start)
```

### Example 2: Healthcare Safety - Client Edition

```
Generic Healthcare Safety Scanner
          │
          ▼
Duplicate Scanner
          │
          ▼
Hospital Client A Scanner
          │
          ├────────────────┐
          ▼                ▼
   Edit for Client A  Edit for Client B
          │                │
          ▼                ▼
Hospital A Safety  Hospital B Safety
          │                │
          ▼                ▼
       Publish          Publish
          │                │
          ▼                ▼
   Tenant A Runtime  Tenant B Runtime
```

## Migration Path

### For New Scanners

1. Start with draft scanner
2. Direct edit during setup (no restrictions)
3. Publish when ready
4. Future edits: safe/additive direct, breaking → duplicate

### For Existing Scanners

1. All existing scanners remain unchanged
2. With submissions: breaking changes trigger duplication
3. Without submissions: direct editing continues
4. Gradually shift mindset from "create version" to "duplicate"

## UI/UX Guidelines

### Scanner List Page

- Show "Duplicate" button prominently
- Consider showing source badge for duplicated scanners
- Filter option: "Show Duplicates" / "Show Originals"

### Scanner Detail Page

- Clear status indicators
- "Duplicate" action in toolbar
- Version list de-emphasized (secondary info)

### Scanner Editor

- Change Impact Indicator shows what type of edit
- Breaking changes blocked with explanation
- "Duplicate Scanner" flow accessible from modal
- Success message after duplication

### Breaking Change Modal

Must show:
- What breaking changes are blocked
- Why they can't be made (submissions protection)
- Clear path forward (Duplicate Scanner)
- Option to cancel

## Technical Implementation

### Change Detection Flow

```typescript
async function handleSaveDraft(scannerId: string, changes: SaveScannerDraftDto) {
  const scanner = await getScanner(scannerId);
  const impacts = detectScannerChanges(scanner.draftVersion, changes);

  if (scanner.hasResponses && impacts.some(i => i.type === 'breaking')) {
    throw new BlockingError('Breaking changes not allowed. Use Duplicate Scanner.');
  }

  return saveScannerDraft(scannerId, changes);
}
```

### Duplicate Flow

```typescript
async function duplicateScanner(sourceId: string, newName: LocalizedText) {
  const source = await getScanner(sourceId);
  const newId = createId('scanner');

  return {
    id: newId,
    name: newName,
    duplicatedFromScannerId: sourceId,
    status: 'draft',
    hasResponses: false,
    // ... full structure copy
  };
}
```

## Future Enhancements

### Phase 4: Enhanced Duplication

1. **Diff View**: Show differences between original and duplicated
2. **Merge Suggestions**: For similar questions between scanners
3. **Template System**: Mark scanners as templates for easy duplication

### Phase 5: Analytics Integration

1. **Comparison Dashboard**: Side-by-side metrics
2. **Trend Analysis**: Compare responses across scanner versions
3. **Migration Tools**: Move submissions between scanner versions

## Key Takeaways

1. **Duplication is Primary**: Major changes = duplicate workflow
2. **Direct Editing for Safe**: Minor edits allowed without friction
3. **Submission Protection**: Breaking changes blocked, not ignored
4. **Clean Isolation**: Each scanner has complete independence
5. **Simple Mental Model**: "Copy this survey" not "branch version"

## Anti-Patterns to Avoid

❌ **Heavy Version Archaeology**
- Don't require users to understand deep version trees
- Don't show confusing lineage in UI

❌ **Forced Versioning**
- Don't create new version for every edit
- Don't make versioning feel mandatory

❌ **Complex Activation Switching**
- Don't make users choose which version to activate
- Keep it simple: one active at a time

❌ **Shared Mutable History**
- Don't let edits to "published" versions affect submissions
- Always use frozen snapshots for submissions

## Conclusion

The NEW canonical strategy:

```
Minor Changes → Direct Edit
Major Redesigns → Duplicate Scanner
Breaking with Submissions → Duplicate Required
```

This provides:
- Clear, business-friendly workflow
- Submission integrity protection
- Simple mental model
- No versioning complexity
- Clean isolation between scanner lifecycles