# Tenant Workflow Tests

## Overview

This document describes the test scenarios for the Tenant module workflow, validating the simplified "Go Live" experience that replaces the complex publish/activate flow.

## Test Scenarios

### TC-TENANT-001: Create New Tenant

**Preconditions**: None

**Steps**:
1. Navigate to /tenants
2. Click "New Tenant"
3. Enter name, slug, subdomain
4. Optionally configure branding
5. Click "Create Tenant"

**Expected**:
- Tenant created with status "Draft Setup"
- Redirect to tenant detail page
- Scanner and template not connected yet
- Go Live button disabled until setup complete

---

### TC-TENANT-002: Configure Survey (Connect Scanner & Template)

**Preconditions**: Tenant exists in Draft Setup status

**Steps**:
1. Navigate to tenant detail page
2. Click "Edit Tenant"
3. Select scanner from dropdown
4. Select attribute template from dropdown
5. Save changes

**Expected**:
- Scanner and template connected
- Go Live button becomes enabled
- Status banner shows "Ready to Publish"

---

### TC-TENANT-003: Go Live Flow (Happy Path)

**Preconditions**: Tenant has scanner and template connected

**Steps**:
1. Navigate to tenant detail page
2. Click "Go Live" button
3. Wait for publish to complete

**Expected**:
- Survey becomes live (status: "Live")
- Subdomain locked (cannot change)
- Go Live button shows "Currently Live"
- Responses can now be collected

---

### TC-TENANT-004: Go Live with Incomplete Setup

**Preconditions**: Tenant has no scanner or no template

**Steps**:
1. Navigate to tenant detail page
2. Attempt to click "Go Live"

**Expected**:
- Go Live button is disabled
- Warning message shown explaining what's missing

---

### TC-TENANT-005: Disable Survey

**Preconditions**: Tenant is Live

**Steps**:
1. Navigate to tenant detail page
2. Click "Disable Survey" button in Operations section

**Expected**:
- Status changes to "Disabled"
- Survey no longer accessible at subdomain
- All submissions and history preserved
- Can click "Re-enable Survey" to go live again

---

### TC-TENANT-006: Re-enable Disabled Survey

**Preconditions**: Tenant is Disabled and has been live before

**Steps**:
1. Navigate to tenant detail page
2. Click "Re-enable Survey" button

**Expected**:
- Status changes back to "Live"
- Survey accessible again at same subdomain

---

### TC-TENANT-007: Archive Survey

**Preconditions**: Tenant is Disabled or Draft

**Steps**:
1. Navigate to tenant detail page
2. Click "Archive Survey"
3. Confirm in modal dialog

**Expected**:
- Status changes to "Archived"
- Subdomain released
- All data preserved
- Can restore later with new subdomain

---

### TC-TENANT-008: Restore Archived Survey

**Preconditions**: Tenant is Archived

**Steps**:
1. Navigate to tenant detail page
2. Click "Restore Survey"
3. Optionally enter new subdomain
4. Confirm in modal

**Expected**:
- Status changes to "Disabled" (not Live)
- New subdomain applied if specified
- Can go live again with new configuration

---

### TC-TENANT-009: Delete Draft Tenant

**Preconditions**: Tenant is Draft with no submissions and no published configs

**Steps**:
1. Navigate to tenant detail page
2. Click "Delete Draft"
3. Type tenant slug to confirm

**Expected**:
- Tenant permanently deleted
- Redirect to tenants list
- No data preserved

---

### TC-TENANT-010: Subdomain Behavior

**Test Subdomain Locking**

**Preconditions**: Tenant is Draft

**Steps**:
1. Try to edit tenant to change subdomain

**Expected**: Subdomain can be changed

**Preconditions**: Tenant has gone Live

**Steps**:
1. Try to edit tenant to change subdomain

**Expected**: Subdomain field is locked, error shown explaining why

---

### TC-TENANT-011: Survey Preview

**Preconditions**: Tenant has branding configured

**Steps**:
1. Navigate to tenant detail page
2. View "Survey Appearance" card in right sidebar

**Expected**:
- Shows preview of branding theme
- Helps admin understand what respondents will see

---

### TC-TENANT-012: Empty States

**Empty Scanner**

**Preconditions**: Tenant has no scanner connected

**Expected**: Shows "No scanner connected. Go to Edit to connect one."

**Empty Template**

**Preconditions**: Tenant has no template connected

**Expected**: Shows "No template connected. Go to Edit to connect one."

---

## Running Tests

```bash
# Start development server
npm run dev

# Navigate to tenant pages and test manually
# /tenants - tenant list
# /tenants/new - create new tenant
# /tenants/[id] - tenant detail
# /tenants/[id]/edit - edit tenant
```

## Test Accounts

Use seeded admin account:
- Email: `admin@remedygcc.local`
- Password: `admin123!`