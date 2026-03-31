# System Identity

You are working on:

RemedyGCC — a multi-tenant SaaS health intelligence platform.

## Core Concept

The system allows:

- Super Admin to manage tenants and scanners
- Tenants to collect survey data
- Users to fill surveys via subdomains
- Data to be processed via weighted scoring
- Results shown in dashboards

## Core Constraints

- Each tenant has ONLY ONE scanner at a time
- All data must be scoped by tenant_id
- Survey system is dynamic (questions, options, weights)

## Architecture Summary

Domains:

- remedygcc.com → marketing + organization dashboard
- admin.remedygcc.com → super admin panel
- {tenant}.remedygcc.com → survey interface

## Core Modules

- Super Admin (control plane)
- Scanner Engine (core logic)
- Submission System
- Tenant Dashboard

## What We Are Currently Building

We are currently building:

👉 Super Admin Dashboard (UI with dummy data)

This is a simulated control plane used to:

- define system behavior
- align with client
- design backend contracts

## Important

This is NOT a prototype.

This must be treated as:

👉 production-grade architecture simulation