# Calculation Engine Architecture

## Overview

The Calculation Engine is a pure, deterministic calculation infrastructure for the RemedyGCC scoring system. It provides centralized score calculation for tenant submissions without any side effects or external dependencies.

## Design Principles

### Pure Functions
- No database access
- No API calls
- No state management
- No UI dependencies

### Deterministic Results
- Same inputs always produce same outputs
- No random elements
- No time-dependent calculations
- Fully reproducible

### Modular Architecture
- Separate concerns: contracts, normalizers, formulas, engine
- Formula registry pattern for extensibility
- Clear boundaries between layers

### Testability
- All functions are pure and easily testable
- Deterministic fixtures for unit tests
- Clear input/output contracts

## Module Structure

```
/modules/calculation
├── contracts/
│   └── types.ts          # Core type definitions
├── engine/
│   ├── calculate.ts      # Core calculation functions
│   └── index.ts          # Public API
├── formulas/
│   └── index.ts          # Formula registry
├── normalizers/
│   └── index.ts          # Health/Risk normalizers
├── tests/
│   ├── fixtures.ts       # Test fixtures
│   └── calculation.test.ts # Unit tests
├── index.ts              # Module exports
└── docs/
    ├── calculation-engine-architecture.md
    ├── calculation-contracts.md
    └── calculation-formulas.md
```

## Calculation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CalculationInput                         │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ ScannerStructure│    │   SubmissionResponses        │   │
│  │ - questions     │    │   - responses[]              │   │
│  │ - domains       │    │   - metadata                 │   │
│  │ - categories    │    │                              │   │
│  └─────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ validateInput()                                             │
│ - Validates scanner structure                               │
│ - Validates responses                                       │
│ - Returns ValidationResult                                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ calculateSubmission()                                        │
│                                                              │
│ For each domain:                                            │
│   1. Group responses by domain                               │
│   2. Calculate WRS for each question                        │
│   3. Sum weighted scores (ΣWRS)                             │
│   4. Calculate MPS                                          │
│   5. Normalize using formula type                           │
│   6. Return DomainCalculationResult                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  SubmissionCalculationResult                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ domainResults[]                                      │   │
│  │   - domainId, domainName, formulaType               │   │
│  │   - weightedScores[]                                 │   │
│  │   - sumWeightedScores, maximumPossibleScore         │   │
│  │   - normalizedScore                                 │   │
│  │                                                      │   │
│  │ totalWeightedScores                                  │   │
│  │ totalMaximumPossibleScore                           │   │
│  │ overallScore (weighted average)                     │   │
│  │ calculatedAt, calculationVersion                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Contracts (types.ts)
- Defines all input/output types
- Strongly typed interfaces
- No implementation details

### 2. Normalizers (normalizers/index.ts)
- Pure math functions
- normalizeHealthScore: (ΣWRS/MPS) × 100
- normalizeRiskScore: (1 - ΣWRS/MPS) × 100

### 3. Formula Registry (formulas/index.ts)
- Maps formula types to normalizers
- Extensible for future formula types
- Single source of truth

### 4. Calculation Engine (engine/calculate.ts)
- Primary entry: calculateSubmission()
- Validation: validateInput()
- Domain aggregation
- Result compilation

## Traceability

The engine provides full traceability in results:

- Question-level weighted scores
- Domain-level aggregation
- MPS calculations
- Normalization path

This enables:
- Debugging of score discrepancies
- Audit trails
- Analytics exports
- Dashboard drill-downs

## Extensibility

To add a new formula type:

1. Add to FormulaType in contracts
2. Implement normalizer function
3. Register in formulaRegistry

Example:
```ts
// In formulas/index.ts
export const formulaRegistry: FormulaRegistry = {
  health: normalizeHealthScore,
  risk: normalizeRiskScore,
  // Add new formula
  custom: normalizeCustomScore,
};
```

## Versioning

The engine tracks its own version:
- `engineVersion` exported from engine
- Included in calculation results
- Enables backward compatibility

## Summary

The Calculation Engine provides:
- Single source of truth for all score calculations
- Pure, deterministic, testable functions
- Clean separation of concerns
- Full traceability in results
- Easy extensibility for future formula types