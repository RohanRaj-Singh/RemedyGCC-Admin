# 🧠 RemedyGCC Scanner System — AI Context & Business Rules

## 🎯 Purpose

This document defines **ALL finalized business rules, architecture decisions, and constraints** for the Scanner System.

This is the **single source of truth** for all AI agents and developers.

No assumptions. No deviations.

---

# 🧱 1. SYSTEM OVERVIEW

RemedyGCC is a **multi-tenant assessment platform**.

The Scanner is a **structured scoring engine**, NOT a simple survey.

It:

* collects responses
* calculates weighted scores
* aggregates into categories
* powers dashboards

---

# 🧩 2. TAXONOMY STRUCTURE (STRICT)

The system follows a **3-level hierarchy**:

```text
Scanner (Total = 100%)

└── Main Categories (L1)
      └── Subdomains (L2)
            └── Questions (L3)
```

---

## ✅ RULES

### 2.1 Main Categories (L1)

* Exactly **5 categories per scanner**
* Same categories across all tenants (fixed methodology)
* Must sum to **100% total weight**

Example:

```text
Mental Health = 40%
Leadership = 10%
Morale = 15%
...
Total = 100%
```

---

### 2.2 Subdomains (L2)

* Each category contains multiple subdomains
* Subdomain weights must sum to **parent category weight**

Example:

```text
Mental Health = 40%
 ├ Depression = 10%
 ├ Anxiety = 15%
 ├ Burnout = 15%
```

---

### 2.3 Questions (L3)

* Each question belongs to exactly **ONE subdomain**
* Question weights must sum to **subdomain weight**

Example:

```text
Depression = 10%
 ├ Q1 = 3%
 ├ Q2 = 4%
 └ Q3 = 3%
```

---

# 🔢 3. WEIGHT SYSTEM (CRITICAL)

## ✅ GLOBAL RULE

```text
TOTAL WEIGHT MUST ALWAYS EQUAL 100%
```

---

## 🔒 VALIDATION RULES

System MUST block publish if:

* Category total ≠ 100%
* Subdomain total ≠ parent category
* Question total ≠ subdomain

---

# ⚖️ 4. SCORING LOGIC

## 4.1 Score Flow

```text
Question Score
   ↓
Subdomain Score
   ↓
Category Score
   ↓
Final Scanner Score
```

---

## 4.2 Calculation Model

* Each answer maps to a numeric value
* Question contribution = answer score × question weight
* Aggregation is weighted sum

---

# 🔄 5. POLARITY (MANDATORY)

Each category must define polarity:

```ts
polarity: "positive" | "negative"
```

---

## 5.1 Positive Domains

```text
100% = BEST
Examples:
- Leadership
- Morale
```

---

## 5.2 Negative Domains

```text
100% = WORST
Examples:
- Burnout
- Clinical Risk
```

---

## 5.3 UI REQUIREMENT

```text
Positive:
High score → GREEN

Negative:
High score → RED
```

---

# 🔁 6. FOLLOW-UP QUESTIONS

## REQUIRED FEATURE

* System must support conditional follow-up questions

---

## ⚠️ IMPLEMENTATION RULE

Follow-up questions:

* Have higher weight than normal questions
* Must be included in total 100% weight calculation

---

## 🚨 NOTE

Follow-ups do NOT dynamically change total weight.

They are pre-allocated within 100%.

---

# ❌ 7. QUESTION TYPES

## MVP SUPPORT

```text
ONLY multiple choice questions
```

No:

* text input
* sliders
* ratings

---

# 🔒 8. EDITING RULES

## After responses exist:

```text
❌ Cannot change weights
❌ Cannot change structure
✅ Can change wording/text only
```

---

# 🧬 9. SCANNER VERSIONING (MANDATORY)

## RULE

Scanner updates create **new version**, not overwrite.

---

## STRUCTURE

```text
Scanner
 ├ Version 1
 ├ Version 2
 └ Version N
```

---

## RESPONSE BINDING

Each response MUST store:

```ts
scannerVersionId
```

---

## RESULT

```text
Old data remains unchanged and valid
```

---

# 🎨 10. BRANDING

## RULE

Branding is **tenant-level only**

---

## NOT ALLOWED

```text
❌ Scanner-level branding
```

---

## STRUCTURE

```ts
Tenant {
  logo
  primaryColor
  secondaryColor
}
```

---

# 📊 11. DASHBOARD RULES

## CLIENT PERMISSIONS

Clients can:

* view responses
* view reports
* filter data
* export data

---

## CLIENT CANNOT:

```text
❌ Modify scanner
❌ Modify weights
❌ Modify categories
❌ Modify scoring
❌ Customize dashboard structure
```

---

## DASHBOARD IS:

```text
Fixed and standardized across all tenants
```

---

# 📤 12. EXPORTS

## REQUIRED

* PDF export
* Excel export

---

## PERMISSION

```text
Only Super Admin can export
```

---

# 🌍 13. MULTI-LANGUAGE

## REQUIRED

* English
* Arabic (RTL support mandatory)

---

# 🚫 14. HARD RESTRICTIONS

## NEVER ALLOW:

```text
❌ Weight total ≠ 100%
❌ Question in multiple categories
❌ Editing weights after responses
❌ Client modifying methodology
❌ Scanner without categories
```

---

# 🧠 15. DESIGN PRINCIPLES

* System is **structured and controlled**
* NOT a flexible survey builder
* Must enforce rules strictly
* Must protect data integrity

---

# 🔥 16. FINAL SYSTEM IDENTITY

This is:

```text
A weighted hierarchical assessment engine
with polarity-aware scoring and strict validation
```

NOT:

```text
A generic form builder
```

---

# ⚠️ 17. AI IMPLEMENTATION RULES

When building:

* Do NOT assume flexibility unless defined
* Do NOT add extra config options
* Do NOT allow bypassing validations
* Always enforce hierarchy and weight constraints

---

# ✅ END OF SPEC

This document is final.

All implementations must follow it strictly.
