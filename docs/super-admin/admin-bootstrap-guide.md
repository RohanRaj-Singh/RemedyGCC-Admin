# Admin Bootstrap Guide

## Overview

This guide covers how to set up the initial Super Admin account for the RemedyGCC platform.

## Prerequisites

- MongoDB running at the configured URI
- Node.js environment set up
- `.env.local` file configured

## Configuration

Add the following to your `.env.local` file:

```env
# Required for seeding
ADMIN_EMAIL=admin@remedygcc.local
ADMIN_PASSWORD=YourSecurePassword123!

# Optional - defaults shown
MONGODB_URI=mongodb://localhost:27017/tenantapp
MONGOSH_PATH=C:\mongosh\bin\mongosh.exe
SESSION_EXPIRY_DAYS=7
```

## Seeding the Admin

Run the seed command to create the initial admin:

```bash
cd remedygcc-admin
npm run seed:admin
```

### Expected Output (First Run)

```
🌱 Seeding admin account...

✅ Admin created successfully!
   Email: admin@remedygcc.local
   Role: super_admin
   Status: active

📝 You can now login at /login
```

### Expected Output (Subsequent Runs)

```
🌱 Seeding admin account...

⚠️  Admin already exists: admin@remedygcc.local
   Role: super_admin
   Status: active

✅ Seed skipped (admin already exists.)
```

## Login Flow

1. Navigate to `/login`
2. Enter your admin credentials
3. Click "Sign In"
4. You'll be redirected to `/scanners` dashboard

## Session Lifecycle

- **Session Duration**: 7 days (configurable via SESSION_EXPIRY_DAYS)
- **Cookie**: HttpOnly, Secure (production), SameSite=lax
- **Storage**: MongoDB adminSessions collection with TTL index
- **Single Session**: New login invalidates all existing sessions

## Security Features

- Passwords hashed with bcrypt (12 rounds)
- Session tokens are cryptographically random (UUID + 32 bytes)
- Session auto-expire via MongoDB TTL index
- Middleware validates session on every protected request

## Troubleshooting

### "No ADMIN_EMAIL or ADMIN_PASSWORD configured"

Ensure your `.env.local` file has both variables set:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=SecurePass123!
```

### "Failed to seed admin" - MongoDB connection error

Verify MongoDB is running and the connection string is correct:

```bash
# Test MongoDB connection
mongosh mongodb://localhost:27017/tenantapp
```

### Login fails after seeding

1. Verify admin exists in database:
   ```javascript
   db.admins.findOne({ email: "admin@remedygcc.local" })
   ```

2. Check password hash exists:
   ```javascript
   db.admins.findOne({ email: "admin@remedygcc.local" }).passwordHash
   ```

3. Verify sessions collection:
   ```javascript
   db.adminSessions.findOne({ adminId: "<admin-id>" })
   ```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| ADMIN_EMAIL | Yes | - | Admin email for seeding |
| ADMIN_PASSWORD | Yes | - | Admin password for seeding |
| SESSION_EXPIRY_DAYS | No | 7 | Session duration in days |
| MONGODB_URI | No | mongodb://localhost:27017/tenantapp | Database connection |
| MONGOSH_PATH | No | C:\mongosh\bin\mongosh.exe | Path to mongosh |

## Development Notes

- Never commit credentials to version control
- Use different passwords for development and production
- The seed script is safe to run multiple times (idempotent)
- Password is hashed before storage - never stored in plain text