# Tenant Workflow Edge Cases

## Overview

This document describes edge cases and boundary conditions for the Tenant module workflow.

---

## EC-TENANT-001: Incomplete Setup

**Scenario**: Try to go live without scanner OR without template

**Expected Behavior**: 
- Go Live button disabled
- Warning message explains what's missing
- No error thrown

---

## EC-TENANT-002: Duplicate Subdomain

**Scenario**: Try to create/restore tenant with already-used subdomain

**Expected Behavior**: 
- Error message "Subdomain X is already in use"
- Operation fails gracefully

---

## EC-TENANT-003: Live Survey Replacement

**Scenario**: Tenant is live, admin makes changes to scanner/template then goes live again

**Expected Behavior**:
- New version replaces current live survey
- Old submissions preserved with original survey version
- Internal snapshot system maintains integrity

**Note**: Backend still uses immutable snapshots - this is hidden from admin UX.

---

## EC-TENANT-004: Archived Subdomain Reuse

**Scenario**: Tenant is archived, subdomain released, another tenant takes it

**Expected Behavior**: 
- Archived tenant cannot be restored to original subdomain
- Must use new subdomain for restore
- Clear message about original subdomain being unavailable

---

## EC-TENANT-005: Submission Safety

**Scenario**: Tenant has submissions, try to delete or archive

**Expected Behavior**:
- Delete option not available (only for draft with no submissions)
- Archive allowed - submissions preserved
- Submissions remain accessible in historical data

---

## EC-TENANT-006: Rollback Safety

**Scenario**: Tenant goes live, submissions collected, admin wants to "undo"

**Current Behavior**: 
- Cannot "unpublish" in traditional sense
- Can disable to stop new submissions
- Historical submissions always reference the survey version they were submitted against

**Note**: This is a safety feature, not a bug. Submissions are stable.

---

## EC-TENANT-007: Duplicate Go Live Click

**Scenario**: User clicks "Go Live" button twice rapidly

**Expected Behavior**:
- First click triggers publish
- Second click ignored or shows loading state
- No duplicate publish created

---

## EC-TENANT-008: Network Failure During Go Live

**Scenario**: Network fails mid-publish

**Expected Behavior**:
- Error message displayed
- Tenant status unchanged
- No partial state created

---

## EC-TENANT-009: Edit While Live

**Scenario**: Tenant is live, admin clicks "Edit Tenant"

**Expected Behavior**:
- Edit page accessible
- Scanner/template can be changed
- Changes require another "Go Live" to take effect
- Live survey remains unchanged until new publish

---

## EC-TENANT-010: Branding While Live

**Scenario**: Tenant is live, admin changes branding

**Expected Behavior**:
- Branding can be edited
- Changes require "Go Live" to apply to respondent-facing survey
- Live survey keeps previous branding until republish

---

## EC-TENANT-011: Multiple Tenants Same Scanner

**Scenario**: Multiple tenants use same scanner

**Expected Behavior**:
- Supported - scanner can be used by many tenants
- Each tenant gets its own copy/version at publish time
- Scanner edits don't affect live tenants automatically

---

## EC-TENANT-012: Tenant Without Subdomain

**Scenario**: Subdomain field is empty/null

**Expected Behavior**: 
- Fallback to use slug as subdomain
- Domain shows as `${slug}.remedygcc.com`

---

## EC-TENANT-013: Very Long Tenant Name

**Scenario**: Enter very long name for tenant

**Expected Behavior**: 
- UI should truncate with ellipsis
- Should not break layout

---

## EC-TENANT-014: Special Characters in Subdomain

**Scenario**: Try to use special characters in subdomain

**Expected Behavior**:
- Validation prevents special characters
- Clear error message about allowed format
- Only lowercase letters, numbers, hyphens allowed

---

## EC-TENANT-015: Browser Back After Go Live

**Scenario**: User goes live, clicks browser back button

**Expected Behavior**: 
- Page refreshes and shows current Live status
- No error or confusion
- Status banner correctly shows "Live"

---

## EC-TENANT-016: Page Refresh While Editing

**Scenario**: User on edit page, accidentally refreshes

**Expected Behavior**: 
- Changes lost (as expected)
- Clean page reload
- No corrupted state

---

## EC-TENANT-017: Concurrent Edits

**Scenario**: Two admins editing same tenant simultaneously

**Expected Behavior**: 
- Last write wins
- No conflict resolution UI (acceptable for admin tool)

---

## EC-TENANT-018: Tenant Status Stuck

**Scenario**: Tenant stuck in intermediate state due to error

**Expected Behavior**: 
- Error messages help identify issue
- Can retry action
- No orphaned states

---

## EC-TENANT-019: Branding Warnings

**Scenario**: Incomplete or problematic branding configuration

**Expected Behavior**: 
- Warnings shown but don't block Go Live
- Clear guidance on what's suboptimal
- Admins can still proceed

---

## EC-TENANT-020: Zero Questions Scanner

**Scenario**: Scanner has no questions, try to go live

**Expected Behavior**: 
- Should be allowed (edge case)
- Survey with zero questions is valid (though not useful)

---

## Testing Edge Cases

```bash
# Test with various tenant states
# - Draft with no scanner
# - Draft with scanner but no template
# - Ready to go live
# - Live
# - Disabled
# - Archived
# - With submissions
# - Without submissions

# Test subdomain edge cases
# - Very long name
# - Special characters
# - Duplicate subdomain
# - Empty subdomain

# Test error recovery
# - Network failure mid-action
# - Partial form submission
# - Browser refresh during action
```

---

## Internal Architecture Preserved

While the UX is simplified, these internal safety mechanisms remain:

- Immutable runtime snapshots on each publish
- Submission references point to exact survey version
- Historical survey states preserved
- Rollback capability via activation switching

The admin doesn't need to think about these - they just work.