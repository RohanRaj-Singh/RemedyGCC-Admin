# Auth UI Edge Cases

## Overview

This document describes edge cases and error scenarios for the Super Admin Authentication system.

## Edge Cases

### 1. Stale Cookie Handling

#### EC-AUTH-001: Manual Cookie Deletion
**Scenario**: User manually deletes admin_session cookie
**Expected Behavior**: 
- Middleware detects missing cookie
- Redirects to /login
- API routes return 401

#### EC-AUTH-002: Corrupted Cookie Value
**Scenario**: Cookie value is modified/tampered
**Expected Behavior**:
- Middleware performs format validation
- Invalid format triggers redirect to /login
- Cookie is cleared

#### EC-AUTH-003: Browser Session Restore
**Scenario**: User restores previous browser session with old cookies
**Expected Behavior**:
- Session validation checks expiry
- Expired sessions are rejected
- Clean redirect to /login

### 2. Expired Session Handling

#### EC-AUTH-010: Session Past Expiry Date
**Scenario**: Session exists but expiresAt < current time
**Expected Behavior**:
- validateSession returns null
- Session deleted from database
- User redirected to /login with "Session expired" message

#### EC-AUTH-011: Clock Skew
**Scenario**: Client clock is significantly off from server
**Expected Behavior**:
- Server-side validation is authoritative
- TTL index auto-deletes expired sessions
- Consistent behavior regardless of client time

### 3. Deleted Admin Handling

#### EC-AUTH-020: Admin Deleted Mid-Session
**Scenario**: Admin account is deleted while user is logged in
**Expected Behavior**:
- Next validation attempt finds no admin
- Session is invalidated
- User redirected to /login

#### EC-AUTH-021: Admin Disabled Mid-Session
**Scenario**: Admin status changed to 'disabled' while logged in
**Expected Behavior**:
- validateSession checks admin.status
- Disabled admins are rejected
- Session is deleted, user redirected

### 4. Concurrent Login Scenarios

#### EC-AUTH-030: Login While Already Logged In
**Scenario**: User logs in from another browser/device
**Expected Behavior**:
- New login invalidates all existing sessions for that admin
- Old sessions become invalid
- Only new session is valid

#### EC-AUTH-031: Multiple Tabs Same Session
**Scenario**: User has multiple browser tabs with same session
**Expected Behavior**:
- All tabs share the same session
- Logout from one tab invalidates all
- Other tabs redirect to /login

### 5. Network and API Error Handling

#### EC-AUTH-040: Network Failure During Login
**Scenario**: Network error when submitting login
**Expected Behavior**:
- Error message displayed to user
- Retry possible
- No partial state

#### EC-AUTH-041: API Timeout During Auth Check
**Scenario**: /api/auth/me times out
**Expected Behavior**:
- Loading state shown
- Error message after timeout
- Graceful fallback

### 6. Browser Behavior Edge Cases

#### EC-AUTH-050: Back Button After Logout
**Scenario**: User clicks browser back after logging out
**Expected Behavior**:
- Middleware intercepts
- Redirects to /login
- No cached protected content

#### EC-AUTH-051: Browser Auto-Fill on Login Page
**Scenario**: Browser auto-fills with old credentials
**Expected Behavior**:
- Works normally with auto-filled values
- Submit triggers normal validation

### 7. First-Boot State

#### EC-AUTH-060: No Admins Exist
**Scenario**: Fresh installation, no admin seeded
**Expected Behavior**:
- Seed command available: `npm run seed:admin`
- Login page shows normal form
- Attempting login fails appropriately

#### EC-AUTH-061: Invalid Seed Configuration
**Scenario**: Seed run without ADMIN_EMAIL/ADMIN_PASSWORD
**Expected Behavior**:
- Error message with instructions
- No partial admin created

### 8. Session Flicker Prevention

#### EC-AUTH-070: Loading State During Auth Check
**Scenario**: Page loads, auth is being verified
**Expected Behavior**:
- Loading spinner displayed
- No flash of content or flash of unauthenticated state
- Smooth transition to authenticated content

#### EC-AUTH-071: Middleware Chain Behavior
**Scenario**: Multiple middleware running
**Expected Behavior**:
- Auth middleware runs early
- Protected routes blocked before other processing
- Minimal latency impact

## Testing Edge Cases

```bash
# Test cookie tampering
# Modify cookie value in browser DevTools
# Attempt page access

# Test session expiry
# Wait for session to expire OR
# Manually modify expiresAt in MongoDB

# Test concurrent login
# Login in two browsers
# Make request from first after second login
```

## Error Messages Reference

| Scenario | Message |
|----------|---------|
| Invalid credentials | "Invalid email or password." |
| No session | "Authentication required." |
| Expired session | "Session expired. Please log in again." |
| Account disabled | "Your account has been disabled. Contact support." |
| Network error | "An unexpected error occurred. Please try again." |