# Auth Operational Flow

## Overview

This document describes the complete authentication flow for the Super Admin dashboard, from login through session management to logout.

## Flow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Client    │────▶│   Login API  │────▶│   Database  │────▶│    Cookie    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                         │                                        │
                         ▼                                        ▼
                   ┌──────────────┐                        ┌──────────────┐
                   │   Validate   │                        │   Middleware │
                   │   Session   │                        │   (Edge)     │
                   └──────────────┘                        └──────────────┘
```

## Login Flow

### 1. User Submits Credentials

```
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "password123"
}
```

### 2. API Route Handler

**File**: `src/app/api/auth/login/route.ts`

1. Parse request body
2. Extract IP address and user agent
3. Call `login()` from auth service

### 3. Service Layer Authentication

**File**: `src/modules/auth/service.ts`

1. Normalize email (lowercase, trim)
2. Fetch admin from MongoDB
3. Check admin exists
4. Check admin status is 'active'
5. Verify password with bcrypt.compare()
6. Update lastLoginAt timestamp
7. Delete any existing sessions (single session policy)
8. Generate cryptographically random session token
9. Calculate expiry (7 days from now)
10. Create session in MongoDB

### 4. Set Session Cookie

**File**: `src/modules/auth/utils.ts`

```
Cookie: admin_session=<token>
- httpOnly: true
- secure: true (production only)
- sameSite: lax
- path: /
- maxAge: 7 days
```

### 5. Return Response

```json
{
  "success": true,
  "admin": {
    "id": "admin-...",
    "email": "admin@example.com",
    "role": "super_admin"
  }
}
```

### 6. Client Redirect

- Success: Redirect to `/scanners`
- Failure: Show error message

---

## Session Validation Flow

### 1. Middleware (Edge Runtime)

**File**: `src/middleware.ts`

Runs on every request to protected routes.

1. Check if path requires auth
2. Get session token from cookie
3. Validate token format (not DB validation)
4. Allow or redirect

**Why this design**:
- Edge runtime can't access Node.js modules
- Lightweight format check avoids unnecessary DB calls
- Full validation happens in API routes

### 2. API Route Auth Guard

**File**: `src/app/api/_utils/auth-guard.ts`

Runs at the start of protected API endpoints.

1. Get session token from cookie
2. Call `validateSession()` from service
3. Check session exists in DB
4. Check session not expired
5. Check admin still exists and active
6. Update lastAccessedAt timestamp

### 3. Session Validation Logic

**File**: `src/modules/auth/service.ts`

```typescript
async function validateSession(token) {
  // 1. Fetch session from DB
  const session = await getSessionByToken(token);
  if (!session) return null;

  // 2. Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    await deleteSession(token); // Clean up
    return null;
  }

  // 3. Fetch admin
  const admin = await getAdminById(session.adminId);
  if (!admin || admin.status === 'disabled') {
    await deleteSession(token);
    return null;
  }

  // 4. Update access time
  await updateSessionAccess(token);

  return { admin, session };
}
```

---

## Protected Routes

### Page Routes (via Middleware)

- `/scanners` - Scanner management
- `/scanners/*` - Scanner detail/edit
- `/tenants` - Tenant management
- `/tenants/*` - Tenant detail/edit
- `/attribute-templates` - Template management
- `/settings` - Admin settings
- `/logs` - System logs

### API Routes (via Auth Guard)

- `/api/super-admin/*` - All super admin APIs
- `/api/scanners/*` - Scanner APIs
- `/api/tenants/*` - Tenant APIs

### Public Routes

- `/login` - Login page
- `/api/auth/login` - Login endpoint
- `/api/auth/logout` - Logout endpoint
- `/api/auth/me` - Current session endpoint
- `/api/survey/*` - Tenant runtime (public)
- `/api/public/*` - Tenant runtime (public)

---

## Logout Flow

### 1. User Clicks Logout

Triggered from sidebar in any protected layout.

### 2. API Call

```
POST /api/auth/logout
```

### 3. Service Layer

1. Get session token from cookie
2. Delete session from MongoDB
3. Clear cookie

### 4. Client Redirect

- Redirect to `/login`

### 5. Browser Back Button

After logout, pressing back button:
- Middleware intercepts
- No valid session cookie
- Redirects to `/login`

---

## Session Cleanup

### Automatic Cleanup (TTL Index)

**MongoDB Configuration**:
```javascript
db.adminSessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
```

Sessions automatically deleted when expiresAt < current time.

### Manual Cleanup

**File**: `src/server/auth/repository.ts`

```typescript
async function cleanupExpiredSessions() {
  // Called periodically or on startup
}
```

---

## Security Considerations

### Cookie Security

| Setting | Development | Production |
|---------|-------------|------------|
| httpOnly | true | true |
| secure | false | true |
| sameSite | lax | lax |
| path | / | / |
| maxAge | 7 days | 7 days |

### Session Token Security

- Generated using `uuid` + 32 bytes of `crypto.randomBytes()`
- Stored only in MongoDB (not in cookie value)
- Cookie contains only the token string

### Rate Limiting

Currently implemented at client-side validation. Consider adding server-side rate limiting for production.

---

## Error States

| State | HTTP Status | Message |
|-------|-------------|---------|
| Invalid credentials | 401 | "Invalid email or password." |
| No session | 401 | "Authentication required." |
| Expired session | 401 | "Session expired. Please log in again." |
| Disabled admin | 401 | "Your account has been disabled. Contact support." |

---

## File Reference

| File | Purpose |
|------|---------|
| `src/modules/auth/service.ts` | Core auth logic (login, logout, validate) |
| `src/server/auth/repository.ts` | MongoDB operations |
| `src/modules/auth/utils.ts` | Cookie helpers |
| `src/modules/auth/server.ts` | Server component helpers |
| `src/middleware.ts` | Route protection (Edge) |
| `src/app/api/_utils/auth-guard.ts` | API route auth |
| `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/me/route.ts` | Current session endpoint |
| `src/context/AuthProvider.tsx` | Client auth state |
| `src/components/layout/Sidebar.tsx` | Auth-aware navigation |