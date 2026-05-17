# Tenant Authentication Tests

## Covered Test Areas

The tenant auth suite validates:

- successful login flow
- logout session invalidation
- lifecycle blocking for `draft`, `disabled`, and `archived` tenants
- password reset flow
- must-change-password behavior
- session expiry invalidation
- access management create/disable/reactivate flows
- tenant route protection helpers
- tenant/admin auth isolation signals
- rate limiting for repeated invalid logins

## Fixture Model

Tenant auth fixtures include:

- active tenant
- disabled tenant
- archived tenant
- draft tenant
- active tenant without credentials for provisioning tests
- expired tenant session
- password reset and forced-change flow data

## Test Style

Tenant auth tests are service-level and use in-memory repositories.

This keeps the suite focused on:

- auth rules
- lifecycle enforcement
- password logic
- session invalidation
- login throttling

The Mongo shell repository remains the production persistence layer, while the tests exercise the business rules without depending on a local Mongo shell runtime.

## Runner

`npm test` runs the tenant-auth suite through `tsx --test`.
