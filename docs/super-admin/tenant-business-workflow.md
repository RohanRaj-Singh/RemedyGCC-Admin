# Tenant Business Workflow

## Canonical Business Flow

Business users should think about tenant setup in this order:

```text
Create Tenant
-> Configure Scanner
-> Configure Attributes
-> Configure Branding
-> Publish Survey
-> Survey Goes Live
```

## Primary Screens

The tenant edit flow is organized into four business-facing sections:

1. `Tenant Info`
   Tenant name, slug, survey address, and current status.
2. `Survey Setup`
   Scanner and attribute template selection for the next publish.
3. `Survey Branding`
   Theme customization for the respondent-facing survey.
4. `Publish State`
   Readiness, publish preview, live survey actions, and published survey history.

## Business Status Language

The primary tenant UX uses these labels:

- `Draft Setup`
  The tenant is still being configured and is not available to respondents.
- `Ready to Publish`
  The setup is complete enough to publish the survey.
- `Live Survey Active`
  The survey is available to respondents.
- `Survey Disabled`
  Survey access is paused while history and submissions remain preserved.
- `Archived`
  The tenant is preserved for history and protected from further operational changes.

## Business Actions

The tenant workflow exposes these actions prominently:

- `Save Draft`
- `Publish Survey`
- `Use Existing Published Survey`
- `Disable Survey`
- `Reactivate Survey`
- `Archive Tenant`

These actions map to the existing safe backend flows without exposing internal publish plumbing.

## Publish Preview Rules

The publish preview shows only business-friendly survey information:

- scanner name
- attribute template name
- branding/theme summary
- category count
- question count
- publish readiness

Primary tenant screens do not surface raw runtime snapshot identifiers or version tuple identifiers.

## Detail View Expectations

The tenant details page should help an admin answer:

1. Is this survey live?
2. What scanner and attribute template are selected?
3. How many published surveys exist?
4. How many submissions have been collected?
5. Which safe actions are available next?

## UX Boundary

The business workflow intentionally hides infrastructure terminology such as:

- runtime config IDs
- branding version IDs
- calculation version IDs
- attribute template version IDs

Those details remain available only in secondary technical views for debugging and support.
