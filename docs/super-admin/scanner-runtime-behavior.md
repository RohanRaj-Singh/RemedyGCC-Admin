# Scanner Runtime Behavior

This document outlines how the Scanner module interacts with the overarching Super Admin and Tenant runtime systems, emphasizing the stable canonical architecture.

## 1. Scanner Lifecycle

The scanner operates in two distinct modes:

1. **Draft Mode**: Scanners are actively mutated in the Builder UI. During this phase, questions, options, triggers, and weights can be freely added, modified, or deleted. The `status` remains `'draft'`.
2. **Published Mode**: Once validated, a draft is locked. Its `status` becomes `'published'`, and a `publishedAt` timestamp is recorded. A published scanner is immutable. If a Super Admin needs to edit a published scanner, a new version (incrementing `versionNumber`) is minted as a draft, ensuring historical data relies on a stable snapshot.

## 2. Immutable Scanner Versions

Immutability guarantees that runtime submissions (Tenant surveys) are always evaluated against the exact structural snapshot that existed when the user hit "Submit".
- When a `ScannerVersionDocument` is created, its schema is frozen.
- If a tenant binds to Version 1, they remain on Version 1 until an administrator explicitly upgrades their runtime config to Version 2.

## 3. Runtime Exports

When the Super Admin publishes a scanner, it acts as a blueprint for tenants.
The runtime expects exactly:
- UUID-style IDs.
- Explicit `score` values for every answer option (e.g., 0, 50, 100).
- Explicit sequential `order` numbers (e.g., 1, 2, 3) for categories, subdomains, questions, and options.

No runtime translation layers or mapping functions are needed; the Mongo document schema `ScannerVersionDocument` maps 1:1 with the canonical `RuntimeScannerVersion` contract.

## 4. Follow-up Behavior

Follow-up questions are strictly diagnostic.
- They are initialized with `kind: "follow-up"`.
- They are completely omitted from primary survey scoring calculations at the runtime aggregation boundaries.
- The `ScannerFollowUpTrigger` strictly ties a primary question's specific answer options (`triggerOptionIds`) to a follow-up question.
- The system guarantees no recursive triggers (a follow-up triggering another follow-up).

## 5. Publish Safety

The system heavily guards the `publishScannerVersionDocument` action.
- Validates the presence of exactly 5 root categories.
- Ensures total weights sum perfectly to 100%.
- Verifies that every question has at least 2 valid options with assigned explicit scores.
- Validates that every follow-up question is bound to at least one valid primary question trigger.
If any validation fails, the publish is safely rejected, blocking malformed structures from entering the runtime ecosystem.
