# Tenant Pages Redesign Review

## Overview

This document reviews the redesigned Tenant Create and Edit pages.

---

## Create Page (`/tenants/new`)

### Before
- Giant form with all options visible at once
- Dense layout with technical-sounding sections
- "Publish + Activate" two-step process shown

### After
- 4-step guided onboarding wizard
- Step indicator with progress visualization
- Progressive disclosure - only relevant options shown per step
- Single "Create Survey" action

### Steps
1. **Basic Info** - Survey name + auto-generated subdomain
2. **Survey Setup** - Scanner and template selection with helper text
3. **Branding** - Live preview card with theme customization
4. **Review** - Confirmation of all settings before create

---

## Edit Page (`/tenants/[id]/edit`)

### Before
- Complex form with multiple panels
- "Business Workflow" sidebar checklist
- Publish/Activate/Disable spread across panels
- Dense configuration layout

### After
- Status banner at top showing current state
- Clean section cards for each configuration area
- Status-aware actions (Go Live, Pause, Resume, Archive)
- Live preview in sidebar
- Change tracking with Save button

### Sections
1. **Status Banner** - Shows current status with colored badge, action buttons
2. **Basic Info** - Name and subdomain (subdomain locked when live)
3. **Survey Setup** - Scanner and template dropdowns
4. **Branding** - Full branding panel with customization
5. **Save Changes** - Only enabled when changes detected

### Sidebar
- Brand preview card
- Live survey details (if active)
- Survey URL display
- Action buttons (Pause/Resume/Archive)

---

## Key Improvements

### Visual Language
- Step indicator on create page
- Status banner with colored badges
- Icon + title + description per section
- Rounded corners, subtle borders, breathing space

### UX Patterns
- Auto-generate subdomain from name
- Helper text explaining each option
- Change tracking (Save button state)
- Success/error feedback messages

### Status-Aware
- Go Live button disabled until scanner + template selected
- Subdomain input locked when survey is live
- Archived surveys have limited editing capability
- Clear action buttons based on current status

---

## What Was Preserved

- All backend safety (immutable snapshots, runtime configs)
- Branding customization options
- Scanner/template selection functionality
- Status transitions (draft → live → disabled → archived)
- Live survey details display

---

## Summary

| Page | Before | After |
|------|--------|-------|
| Create | Dense form | 4-step wizard |
| Edit | Multiple panels | Operational workspace |

Both pages now follow the "calm SaaS workflow" pattern documented in the UX files.