# Architecture
RemedyGCC is a multi-tenant SaaS platform.

Domains:
- remedygcc.com → marketing + dashboard
- admin.remedygcc.com → super admin
- {tenant}.remedygcc.com → survey

Core flow:
Tenant → Scanner → Submission → Analytics → Dashboard
