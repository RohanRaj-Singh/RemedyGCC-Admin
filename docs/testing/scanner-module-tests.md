# Scanner Module Testing

This document outlines the testing strategies for the Scanner Module, particularly focusing on the canonical architecture and real MongoDB integration.

## 1. Create Flow Tests

**Objective:** Verify that creating a new scanner provisions the correct default structure and persists it to the database correctly.

**Test Cases:**
- `test_create_scanner_initializes_five_categories`: Ensures a newly minted scanner automatically receives the 5 fixed categories (`Mental Health`, `Leadership`, `Morale`, `Clinical Risk`, `Workload`).
- `test_create_scanner_creates_draft_version`: Validates that `insertScannerDocument` inserts one base document into `scanners` and one initial draft document into `scannerVersions`.
- `test_create_scanner_generates_stable_ids`: Confirms `createId()` is utilized for all entities, producing valid UUID-style strings.

## 2. Update Flow Tests

**Objective:** Ensure modifications correctly mutate the draft state without corrupting the active published state.

**Test Cases:**
- `test_update_scanner_modifies_draft_only`: Modifying text or options should trigger `updateScannerDraftDocument`, keeping `status: 'draft'`.
- `test_update_scanner_maintains_version_isolation`: If a scanner is published and a new draft is created, modifications to the draft must not bleed into the published version's snapshot.

## 3. Follow-up Tests

**Objective:** Verify the new `primary` to `follow-up` trigger contract functions as designed.

**Test Cases:**
- `test_follow_up_trigger_captures_option_ids`: When a user checks a trigger option, the ID is correctly stored in `triggerOptionIds` (not by score value).
- `test_follow_up_trigger_links_correctly`: The trigger correctly maps `triggerQuestionId` (primary) to `followUpQuestionIds` (diagnostic).

## 4. Validation Tests

**Objective:** Ensure invalid configurations are caught before hitting the database.

**Test Cases:**
- `test_validation_rejects_missing_scores`: A scanner draft must fail validation if any option lacks an explicit, numeric `score`.
- `test_validation_rejects_orphan_follow_ups`: A follow-up question without an inbound trigger fails validation.
- `test_validation_rejects_invalid_weights`: Subdomain questions summing to 30 when the subdomain weight is 40 must fail.
- `test_validation_rejects_missing_text`: Blank English or Arabic translations block publication.

## 5. Publish Safety Tests

**Objective:** Verify immutable versions are protected.

**Test Cases:**
- `test_publish_scanner_locks_version`: Transitioning a draft to published via `publishScannerVersionDocument` correctly stamps `publishedAt` and prevents further edits to that specific ID.
- `test_publish_scanner_requires_validation`: `publishScanner` must explicitly invoke and pass `validateDraft` before executing the Mongo update.

## 6. Mongo Integration Tests

**Objective:** Ensure `runMongoScript` reliably persists data.

**Test Cases:**
- `test_mongo_ensure_indexes`: Verify `ensureScannerModuleIndexes` correctly registers the unique constraints on `scanners` and `scannerVersions`.
- `test_mongo_get_scanner_details`: `getScannerDetailData` must successfully join the base scanner with its versions, sorted by `versionNumber` descending.
