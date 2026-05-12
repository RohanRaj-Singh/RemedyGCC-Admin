# Scanner Module Edge Cases

This document outlines critical edge cases that the Scanner module validation engine and database integration must handle safely to preserve the stability of the RemedyGCC runtime.

## 1. Recursive Follow-ups

**Scenario:** A follow-up question triggers another follow-up question, creating an endless loop or deep nesting not supported by the runtime.
**Resolution:** The validation engine strictly prevents follow-up questions from acting as triggers. A trigger must originate from a `kind: 'primary'` question. This is verified statically during `validateDraft`.

## 2. Duplicate IDs

**Scenario:** Moving or duplicating questions via the UI leads to multiple questions or subdomains having the identical UUID.
**Resolution:** The builder strictly uses `createId('prefix')` to mint fresh, collision-resistant identifiers. The validation engine tracks seen IDs using a `Set` during traversal and strictly halts publication if any ID reuse is detected across the entire scanner hierarchy.

## 3. Invalid Scores

**Scenario:** A user leaves an option score blank, types an alphabetical character, or assumes position-based scoring (e.g. implicitly assigning 0, 50, 100 based on the array order).
**Resolution:** The legacy `polarity` and `isInverted` concepts have been removed. Every option strictly requires an explicit, numeric `score` value. The validation engine asserts that `typeof option.score === 'number'` and `!isNaN(option.score)` before permitting a publish.

## 4. Deleting Active Scanners

**Scenario:** A Super Admin attempts to delete a scanner that has been published, is linked to an active tenant, or has runtime submissions.
**Resolution:** Destructive deletion is heavily restricted. If a scanner is published or has responses, it must be **archived** instead of deleted. Archiving preserves historical integrity for aggregation pipelines and past submissions.

## 5. Invalid Hierarchy

**Scenario:** A category has no subdomains, or a subdomain has no questions, creating empty slots in the runtime pipeline.
**Resolution:** The validation engine enforces structural integrity:
- Exactly 5 categories.
- Every category must have at least one subdomain.
- Every subdomain must have at least one question.
- Every question must have at least two valid answer options.

## 6. Broken Runtime Exports

**Scenario:** The scanner builder emits a data shape that the runtime cannot interpret, causing a crash when a tenant attempts to load the survey.
**Resolution:** The scanner modules strictly adhere to the Canonical Scanner Contract. Identifiers are preserved, exact text maps to exact scores, and the output `ScannerVersionDocument` matches `RuntimeScannerVersion` exactly.

## 7. Unsafe Weight Distributions

**Scenario:** A user configures weights such that categories do not sum to 100, or a subdomain's questions do not sum to the subdomain's total weight.
**Resolution:** The validation engine computes the sum of child weights before allowing publication:
- Category weights must sum to exactly 100.
- Subdomain weights must sum to their parent Category's weight.
- Question weights must sum to their parent Subdomain's weight.
Follow-up questions are excluded from primary scoring calculations but must maintain a weight greater than their sibling primary questions to satisfy aggregation boundary logic.
