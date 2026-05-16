# Calculation Engine Edge Cases

## Overview

This document describes edge cases handled by the Calculation Engine and their expected behavior.

## Zero Scores

### Scenario
All questions answered with 1 (lowest health/highest risk)

**Expected**:
- Health Score: 0%
- Risk Score: 100%

**Behavior**:
- ΣWRS = weights × 1
- MPS = weights × 4
- Normalization handles correctly

### Scenario
No responses in a domain

**Expected**:
- Domain score: 0%
- Question count: 0

**Behavior**:
- Empty weightedScores array
- MPS = 0, division returns 0

## Empty Domains

### Scenario
Scanner has no questions

**Expected**:
- Validation error: "Scanner must have at least one question"

**Behavior**:
- validateInput catches and reports error
- calculateSubmission throws before processing

### Scenario
Domain with no questions

**Expected**:
- Domain result with questionCount: 0
- Score: 0%

**Behavior**:
- Domain appears in results with zero values

## Invalid Weights

### Scenario
Weight is 0

**Expected**:
- WRS = 0 (0 × answer = 0)
- Domain calculation proceeds normally

**Behavior**:
- Question contributes nothing to score

### Scenario
Weight is negative

**Expected**:
- Validation error: "Invalid weight"

**Behavior**:
- calculateWeightedQuestionScore throws

### Scenario
Weight exceeds 100

**Expected**:
- Validation error: "Invalid weight"

**Behavior**:
- calculateWeightedQuestionScore throws

### Scenario
Weight is not a number (NaN, Infinity)

**Expected**:
- Validation error or returns 0

**Behavior**:
- Handled via isFinite check

## Invalid Answers

### Scenario
Answer is 0

**Expected**:
- Validation error: "Invalid answer"

**Behavior**:
- validateInput catches error

### Scenario
Answer is 5 or higher

**Expected**:
- Validation error: "Invalid answer"

**Behavior**:
- validateInput catches error

### Scenario
Answer is negative

**Expected**:
- Validation error: "Invalid answer"

**Behavior**:
- validateInput catches error

### Scenario
Answer is not a number

**Expected**:
- TypeScript prevents at compile time
- Runtime: Validation error

**Behavior**:
- validateInput checks type

## Missing Responses

### Scenario
Submission has no responses

**Expected**:
- Validation error: "Submission must have at least one response"

**Behavior**:
- validateInput catches and reports

### Scenario
Response for unknown question

**Expected**:
- Validation error: "Question not found in scanner"

**Behavior**:
- validateInput checks question exists

### Scenario
Response for question not in any domain

**Expected**:
- Response ignored
- No error (question mapped to no domain)

**Behavior**:
- Question filtered out during aggregation

## Division Edge Cases

### Scenario
MPS is 0 (no questions in domain)

**Expected**:
- Score returns 0
- No division by zero error

**Behavior**:
- normalizeHealthScore/RiskScore handle MPS=0

```ts
if (maximumPossibleScore === 0 || !isFinite(maximumPossibleScore)) {
  return 0;
}
```

### Scenario
MPS is Infinity

**Expected**:
- Score returns 0
- No error

**Behavior**:
- isFinite check handles this

### Scenario
ΣWRS > MPS (should not happen, but handled)

**Expected**:
- Score clamped to 100% maximum

**Behavior**:
- Math.min(1, ratio) ensures max of 100%

## Rounding Behavior

### Scenario
Score has many decimal places

**Expected**:
- Rounded to 2 decimal places

**Behavior**:
- roundScore(score, 2) applied

### Scenario
Very small scores

**Expected**:
- Preserved to 2 decimal places

**Behavior**:
- 0.001 becomes 0.00 (not significant)

## Partial Follow-ups

### Scenario
Follow-up question not triggered (no answer in trigger)

**Expected**:
- Follow-up question not in responses
- Score calculated only for answered questions

**Behavior**:
- Only responses in submission contribute
- Unanswered questions not counted in MPS

### Scenario
Follow-up question answered but trigger wasn't

**Expected**:
- Answer included in calculation
- Normal validation applies

**Behavior**:
- Response recorded normally

## Scanner Version Changes

### Scenario
Submission references old scanner version

**Expected**:
- Calculation uses scanner from input
- No automatic version migration

**Behavior**:
- Scanner version passed through to results
- Audit trail preserved

## Multiple Domains

### Scenario
Domain with different formula types

**Expected**:
- Each domain uses appropriate formula
- health → health normalizer
- risk → risk normalizer

**Behavior**:
- formulaType determines normalizer

### Scenario
All domains have same formula type

**Expected**:
- Works normally
- Different domains can use same formula

**Behavior**:
- No special handling needed

## Validation Order

1. Scanner exists
2. Scanner has questions
3. Scanner has domains
4. Submission exists
5. Submission has responses
6. Response answers are valid (1-4)
7. Questions exist in scanner
8. Formula types are valid

Validation stops at first error for clean error reporting.

## Summary

The Calculation Engine handles all documented edge cases:
- Zero/invalid weights
- Zero/invalid answers
- Empty arrays
- Division by zero
- Rounding
- Partial data
- Multiple formula types

No edge case should produce a silent failure - all are either handled gracefully or produce clear error messages.