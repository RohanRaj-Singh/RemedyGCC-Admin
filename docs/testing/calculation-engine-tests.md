# Calculation Engine Tests

## Overview

This document describes the test strategy and test cases for the Calculation Engine.

## Test Philosophy

The Calculation Engine follows strict testing principles:
- **Deterministic**: Same inputs always produce same outputs
- **Pure**: No side effects, no dependencies on external systems
- **Comprehensive**: All formulas, edge cases, and error paths covered

## Test Structure

```
/modules/calculation/tests/
├── fixtures.ts           # Deterministic test data
└── calculation.test.ts   # Unit tests
```

## Test Fixtures

### Sample Scanner
- Two domains: health and risk
- Five questions total (3 health, 2 risk)
- Varied weights: 30, 20, 50, 40, 60

### Sample Submissions
- **Perfect**: All answers are 4 (healthiest)
- **Worst**: All answers are 1 (highest risk)
- **Middle**: Mixed answers (2, 3, 3, 2, 3)
- **Sample**: Varied (4, 3, 2, 1, 2)

## Test Categories

### 1. Weighted Score Tests

**calculateWeightedQuestionScore**

Tests:
- Correct WRS calculation for all answer values (1-4)
- Correct WRS for various weights (0, 25, 50, 100)
- Throws on invalid answer values (< 1 or > 4)
- Throws on invalid weights (< 0 or > 100)
- Handles zero weight

### 2. MPS Calculation Tests

**calculateMaximumPossibleScore**

Tests:
- Correct MPS for known weight sums
- Returns 0 for empty array
- Handles zero weights
- Scales correctly with weight values

### 3. Health Normalization Tests

**normalizeHealthScore**

Tests:
- Returns 100% for perfect score (ΣWRS = MPS)
- Returns 0% for zero score
- Returns 50% for half score
- Correct calculation for sample data (70%)
- Handles zero MPS

### 4. Risk Normalization Tests

**normalizeRiskScore**

Tests:
- Returns 0% for perfect score (ΣWRS = MPS)
- Returns 100% for zero score
- Returns 50% for half score
- Correct calculation for sample data (60%)
- Handles zero MPS

### 5. Submission Calculation Tests

**calculateSubmission**

Tests:
- Sample submission: health 70%, risk 60%, overall 66%
- Perfect submission: health 100%, risk 0%
- Worst submission: health 0%, risk 100%
- Middle submission: reasonable scores
- Single question scanner
- Includes full traceability

### 6. Validation Tests

**validateInput**

Tests:
- Accepts valid input
- Rejects missing scanner
- Rejects missing submission
- Rejects empty scanner questions
- Rejects invalid answer values (0, 5)
- Rejects unknown question IDs
- Rejects invalid formula types

### 7. Domain Aggregation Tests

Tests:
- Correct domain separation
- Correct ΣWRS per domain
- Correct MPS per domain
- Correct normalization per domain
- Question count per domain

## Running Tests

```bash
# Run all calculation tests
npm test -- calculation

# Run with coverage
npm test -- --coverage calculation

# Run specific test file
npm test -- calculation.test.ts
```

## Expected Test Results

| Test Category | Expected Pass Rate |
|---------------|---------------------|
| Weighted Score | 100% |
| MPS Calculation | 100% |
| Health Normalization | 100% |
| Risk Normalization | 100% |
| Submission Calculation | 100% |
| Validation | 100% |
| Domain Aggregation | 100% |

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment validation

## Coverage Requirements

Minimum coverage:
- **Lines**: 95%
- **Branches**: 90%
- **Functions**: 100%

## Test Data Validation

All test fixtures are validated against pre-computed expected values documented in fixtures.ts. These values are manually calculated using the canonical formulas to ensure test correctness.