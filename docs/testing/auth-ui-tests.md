# Auth UI Tests

## Overview

This document describes the test scenarios for the Super Admin Authentication UI, including login flow, logout, route protection, and session lifecycle.

## Test Scenarios

### 1. Login Flow Tests

#### TC-AUTH-001: Successful Login
**Preconditions**: Admin account exists in database
**Steps**:
1. Navigate to /login
2. Enter valid email and password
3. Click "Sign In"
**Expected**: Redirect to /scanners dashboard

#### TC-AUTH-002: Login with Invalid Credentials
**Preconditions**: Admin account exists
**Steps**:
1. Navigate to /login
2. Enter valid email but wrong password
3. Click "Sign In"
**Expected**: Error message "Invalid email or password."

#### TC-AUTH-003: Login with Empty Fields
**Steps**:
1. Navigate to /login
2. Leave email and password empty
3. Click "Sign In"
**Expected**: Validation errors for empty fields

#### TC-AUTH-004: Login with Nonexistent Email
**Steps**:
1. Navigate to /login
2. Enter email with no admin account
3. Click "Sign In"
**Expected**: Error message "Invalid email or password."

### 2. Logout Tests

#### TC-AUTH-010: Successful Logout
**Preconditions**: Admin is logged in
**Steps**:
1. Click Logout button in sidebar
**Expected**:
- Session removed from database
- Cookie cleared
- Redirect to /login

#### TC-AUTH-011: Logout Clears Session Completely
**Preconditions**: Admin is logged in, multiple browser tabs open
**Steps**:
1. Click Logout in one tab
2. Attempt to navigate to protected page in another tab
**Expected**: Second tab redirects to /login

### 3. Route Protection Tests

#### TC-AUTH-020: Unauthenticated Access to Protected Route
**Preconditions**: No session cookie
**Steps**:
1. Navigate directly to /tenants
**Expected**: Redirect to /login

#### TC-AUTH-021: Accessing /login When Already Authenticated
**Preconditions**: Admin is logged in
**Steps**:
1. Navigate to /login
**Expected**: Redirect to /scanners dashboard

#### TC-AUTH-022: API Route Protection
**Preconditions**: No session
**Steps**:
1. Send GET request to /api/super-admin/tenants
**Expected**: 401 Unauthorized response

### 4. Session Expiry Tests

#### TC-AUTH-030: Session Expired Redirect
**Preconditions**: Session exists but is expired (simulated)
**Steps**:
1. Have an expired session cookie
2. Navigate to protected page
**Expected**: Redirect to /login with error message

### 5. Bootstrap Flow Tests

#### TC-AUTH-040: Initial Admin Seeding
**Preconditions**: No admin accounts exist
**Steps**:
1. Run `npm run seed:admin`
2. Verify admin created in database
3. Attempt login with seeded credentials
**Expected**:
- Admin created successfully
- Login succeeds
- Redirect to dashboard

#### TC-AUTH-041: Seed Prevents Duplicate Admins
**Preconditions**: Admin already exists
**Steps**:
1. Run `npm run seed:admin` again
**Expected**: Skip creation, log "Admin already exists"

## Running Tests

```bash
# Seed admin for testing
npm run seed:admin

# Start development server
npm run dev
```

## Test Accounts

Use the admin seeded via environment variables:
- Email: `admin@remedygcc.local` (or as configured in .env.local)
- Password: As configured in ADMIN_PASSWORD