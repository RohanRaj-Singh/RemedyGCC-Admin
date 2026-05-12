# Validation Sidebar Edge Cases

This document records the edge cases handled by the Scanner Validation engine and its Reactive Sidebar.

## Identified Edge Cases

### 1. Ghost Follow-up Triggers
**Scenario**: A trigger is created for Option A. The user then deletes Option A from the primary question, leaving the trigger pointing to a non-existent option.
**Resolution**: The validation engine's `validateScannerDraft` natively detects this and raises `TRIGGER_OPTION_INVALID`. However, the React `useEffect` inside `ScannerForm.tsx` automatically prunes any stale option references, preventing ghost triggers from lingering.

### 2. Deep Hierarchy Scrolling
**Scenario**: A user clicks a validation error for a question that is deeply nested in a subdomain that isn't currently active on the screen.
**Resolution**: The `handleIssueClick` function explicitly updates `selectedCategoryId` and `selectedSubdomainId` state values before firing the `scrollIntoView` DOM event. A slight timeout ensures the DOM has updated and rendered the target question before scrolling.

### 3. Orphaned Follow-Ups
**Scenario**: A primary question with a follow-up trigger is deleted.
**Resolution**: The pruning logic removes the stale trigger. This inherently turns the follow-up question into an orphan. The validation engine flags `FOLLOW_UP_ORPHANED` (blocking error), forcing the user to either assign a new trigger to the follow-up or delete the follow-up question.

### 4. Weight Imbalance Masking
**Scenario**: Category weights total 100%, but Subdomain weights within Category 1 do not total its allocated Category weight.
**Resolution**: The validation engine processes the hierarchy recursively. Even if the top-level weight is 100%, it explicitly checks `SUBDOMAIN_WEIGHT_MISMATCH` and raises an error, ensuring deep structural integrity. The Click-to-Navigate functionality brings the user directly to Step 3 (Weights).

### 5. Diagnostic Questions With Weights
**Scenario**: User assigns a weight to a follow-up question.
**Resolution**: Historically, the system enforced a "follow-up must weigh more" rule. This legacy requirement has been removed. Follow-ups are purely diagnostic and do not require weights. If a user sets a weight of 0 for a follow-up, it is logged as an `info` level message, not a blocking error.
