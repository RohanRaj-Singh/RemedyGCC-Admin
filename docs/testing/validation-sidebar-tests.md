# Validation Sidebar Tests

This document outlines the testing protocols for the Scanner Validation Sidebar. The validation system provides a hierarchy-aware navigation tool and prevents stale follow-up states.

## Testing Protocols

### 1. Click-to-Navigate Validation
1. Open the Scanner Builder on a draft.
2. Go to Step 2 (Content) and leave a question score blank to trigger an error.
3. Advance to Step 4 (Review & Publish). The Floating Issue Button should pulse red.
4. Click the Floating Issue Button to open the Issue Panel.
5. Click the "Every answer option must have an explicit numeric score" error.
6. **Expected Outcome**: The UI instantly navigates to Step 2, selects the correct Category and Subdomain, and smoothly scrolls the affected question into view with a highlighted blue ring.

### 2. Follow-Up Reactivity and Pruning
1. Create a Primary Question with two options.
2. Create a Follow-Up Question.
3. Assign a Follow-Up Trigger mapping the Primary Question's Option 1 to the Follow-Up Question.
4. Now, delete the Primary Question entirely.
5. **Expected Outcome**: The Follow-Up Trigger should be automatically pruned. No "Trigger Question Missing" error should appear. Instead, the Follow-Up Question should display a "Follow-up question must be triggered by at least one primary question" error (Orphaned Follow-Up).

### 3. Severity Level Verification
1. Create a primary question with 0 weight.
2. Create a follow-up question with 0 weight.
3. Open the Issue Panel.
4. **Expected Outcome**:
   - The primary question should show a red `error` for 0 weight ("Primary question weight must be greater than zero").
   - The follow-up question should show a blue `info` for 0 weight ("Diagnostic follow-ups typically do not need weights").

### 4. Grouped Issue Panel Display
1. Create validation errors across multiple categories (e.g., missing subdomains in Category 1, missing translations in Category 2).
2. Open the Issue Panel.
3. **Expected Outcome**: Errors are grouped logically under headings like "Category 1" and "Category 2", rather than presented as a flat unstructured list.

### 5. Empty State Affirmation
1. Create a perfectly valid scanner (100% weights, proper follow-up structure, all translations present).
2. Open the Issue Panel.
3. **Expected Outcome**: The panel should display a friendly success message ("Scanner structure validated successfully") with a green checkmark, reinforcing that no runtime or publishing issues remain.
