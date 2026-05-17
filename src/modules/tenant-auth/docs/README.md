# Tenant Auth Module

This module owns isolated tenant dashboard authentication for the single-tenant-owner dashboard surface.

It keeps:

- tenant dashboard users separate from super admin users
- tenant dashboard sessions separate from admin sessions
- tenant dashboard cookies separate from admin cookies
- tenant dashboard guards and middleware separate from admin guards and middleware
