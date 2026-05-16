# Calculation Formulas

## Overview

This document describes the core formulas used by the Calculation Engine.

## Answer Scale

**Important**: The system uses a direct answer scale where no inversion is needed:

| Value | Meaning | Impact on Health | Impact on Risk |
|-------|---------|-------------------|----------------|
| 4 | Healthiest | Increases score | Decreases risk |
| 3 | Good | Moderate increase | Moderate decrease |
| 2 | Fair | Low increase | Low decrease |
| 1 | Highest Risk | Minimal increase | High risk |

This scale is used directly - no transformation or inversion logic is required in the calculation engine.

---

## Weighted Raw Score (WRS)

### Formula

```
WRS = RawScore × QuestionWeight
```

### Definition

Each question's contribution to the domain score is calculated by multiplying:
- **RawScore**: The respondent's answer (1-4)
- **QuestionWeight**: The question's weight in the domain (0-100)

### Example

Given a question with weight 30 and answer 4:
```
WRS = 4 × 30 = 120
```

Given a question with weight 50 and answer 2:
```
WRS = 2 × 50 = 100
```

---

## Maximum Possible Score (MPS)

### Formula

```
MPS = Σ(question weights) × 4
```

### Definition

The maximum possible score for a domain is calculated by:
- Summing all question weights in the domain
- Multiplying by the maximum answer value (4)

### Example

For a domain with questions of weights 30, 20, and 50:
```
Total Weight = 30 + 20 + 50 = 100
MPS = 100 × 4 = 400
```

---

## Health Score

### Formula

```
HealthScore = (ΣWRS / MPS) × 100
```

### Definition

The health score represents the percentage of maximum health achieved:
- **100%**: All questions answered with 4 (healthiest)
- **0%**: All questions answered with 1 (highest risk)
- **50%**: Average performance

### Calculation Steps

1. Calculate WRS for each question in the domain
2. Sum all WRS values (ΣWRS)
3. Calculate MPS
4. Divide ΣWRS by MPS
5. Multiply by 100 to get percentage

### Example

Given domain with questions (weights 30, 20, 50) and answers (4, 3, 2):
```
WRS1 = 4 × 30 = 120
WRS2 = 3 × 20 = 60
WRS3 = 2 × 50 = 100
ΣWRS = 120 + 60 + 100 = 280
MPS = (30 + 20 + 50) × 4 = 400
HealthScore = (280 / 400) × 100 = 70%
```

---

## Risk Score

### Formula

```
RiskScore = (1 - ΣWRS / MPS) × 100
       = ((MPS - ΣWRS) / MPS) × 100
```

### Definition

The risk score represents the inverse of health:
- **0%**: All questions answered with 4 (no risk)
- **100%**: All questions answered with 1 (maximum risk)

### Calculation Steps

1. Calculate WRS for each question in the domain
2. Sum all WRS values (ΣWRS)
3. Calculate MPS
4. Subtract ratio from 1
5. Multiply by 100 to get percentage

### Example

Given domain with questions (weights 40, 60) and answers (1, 2):
```
WRS1 = 1 × 40 = 40
WRS2 = 2 × 60 = 120
ΣWRS = 40 + 120 = 160
MPS = (40 + 60) × 4 = 400
RiskScore = (1 - 160/400) × 100 = 60%
```

---

## Overall Score

### Formula

```
OverallScore = Σ(domainScore × domainWeight) / Σ(questionCount)
```

### Definition

The overall score is a weighted average of all domain scores:
- Each domain's score is weighted by its question count
- Provides a single aggregate score for the submission

### Calculation Steps

1. Calculate normalized score for each domain
2. Multiply each domain score by its question count
3. Sum all weighted domain scores
4. Divide by total question count

### Example

Given:
- Health domain: 3 questions, 70% score → 70 × 3 = 210
- Risk domain: 2 questions, 60% score → 60 × 2 = 120

```
OverallScore = (210 + 120) / 5 = 66%
```

---

## Formula Registry

The engine uses a registry pattern for formulas:

```ts
const formulaRegistry = {
  health: normalizeHealthScore,
  risk: normalizeRiskScore,
};
```

This allows adding new formula types without modifying the core engine.

---

## Implementation Notes

### Rounding
- All scores are rounded to 2 decimal places
- Prevents floating-point precision issues

### Edge Cases
- Division by zero (MPS = 0) returns 0
- Invalid inputs throw errors with clear messages

### Traceability
- Each weighted score is preserved in results
- Normalization path is visible in output
- MPS calculation is included

---

## Summary

| Formula | Purpose | Higher = |
|---------|---------|----------|
| WRS | Individual question contribution | More weight |
| MPS | Maximum possible for domain | N/A |
| HealthScore | Domain health percentage | Healthier |
| RiskScore | Domain risk percentage | Higher risk |
| OverallScore | Submission aggregate | Overall better |