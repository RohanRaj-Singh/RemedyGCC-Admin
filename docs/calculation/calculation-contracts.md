# Calculation Contracts

## Overview

This document describes the input and output contracts for the Calculation Engine.

## Core Types

### FormulaType

```ts
type FormulaType = 'health' | 'risk';
```

- `health`: Higher percentage = healthier outcome
- `risk`: Higher percentage = higher risk outcome

### AnswerValue

```ts
type AnswerValue = 1 | 2 | 3 | 4;
```

Scale: 4 = healthiest, 1 = highest risk. No inversion logic required.

### QuestionWeight

```ts
type QuestionWeight = number; // 0-100
```

Weight determines question's impact on final domain score.

---

## Input Contracts

### ScannerStructure

```ts
interface ScannerStructure {
  scannerId: string;
  version: string;
  questions: QuestionDefinition[];
  domains: DomainDefinition[];
  categories: CategoryDefinition[];
}
```

- **scannerId**: Unique scanner identifier
- **version**: Scanner version string
- **questions**: Array of question definitions
- **domains**: Array of domain definitions
- **categories**: Array of category definitions

### QuestionDefinition

```ts
interface QuestionDefinition {
  id: QuestionId;
  categoryId: CategoryId;
  weight: QuestionWeight;
  domainId: DomainId;
}
```

- **id**: Unique question identifier
- **categoryId**: Parent category
- **weight**: Question weight (0-100)
- **domainId**: Associated domain

### DomainDefinition

```ts
interface DomainDefinition {
  id: DomainId;
  formulaType: FormulaType;
  name: string;
}
```

- **id**: Unique domain identifier
- **formulaType**: 'health' or 'risk'
- **name**: Human-readable domain name

### SubmissionResponses

```ts
interface SubmissionResponses {
  submissionId: string;
  tenantId: string;
  scannerId: string;
  scannerVersion: string;
  responses: ResponseAnswer[];
  submittedAt: string;
}
```

- **submissionId**: Unique submission ID
- **tenantId**: Tenant that owns this submission
- **scannerId**: Scanner used
- **scannerVersion**: Scanner version at submission time
- **responses**: Array of answers
- **submittedAt**: ISO timestamp

### ResponseAnswer

```ts
interface ResponseAnswer {
  questionId: QuestionId;
  answer: AnswerValue;
}
```

- **questionId**: Question being answered
- **answer**: Answer value (1-4)

### CalculationInput

```ts
interface CalculationInput {
  scanner: ScannerStructure;
  submission: SubmissionResponses;
  includeTraceability?: boolean;
}
```

- **scanner**: Scanner structure definition
- **submission**: Submission responses
- **includeTraceability**: Include detailed breakdown (default: true)

---

## Output Contracts

### WeightedQuestionResult

```ts
interface WeightedQuestionResult {
  questionId: QuestionId;
  domainId: DomainId;
  rawScore: AnswerValue;
  weight: QuestionWeight;
  weightedScore: number;
}
```

- **questionId**: Question identifier
- **domainId**: Domain this question belongs to
- **rawScore**: Original answer (1-4)
- **weight**: Question weight
- **weightedScore**: RawScore × Weight

### DomainCalculationResult

```ts
interface DomainCalculationResult {
  domainId: DomainId;
  domainName: string;
  formulaType: FormulaType;
  weightedScores: WeightedQuestionResult[];
  sumWeightedScores: number;
  maximumPossibleScore: number;
  normalizedScore: number;
  questionCount: number;
}
```

- **domainId**: Domain identifier
- **domainName**: Human-readable name
- **formulaType**: 'health' or 'risk'
- **weightedScores**: Question-level details
- **sumWeightedScores**: ΣWRS (sum of weighted raw scores)
- **maximumPossibleScore**: MPS (maximum possible score)
- **normalizedScore**: Final percentage (0-100)
- **questionCount**: Number of questions in domain

### SubmissionCalculationResult

```ts
interface SubmissionCalculationResult {
  submissionId: string;
  tenantId: string;
  scannerId: string;
  scannerVersion: string;
  submittedAt: string;
  domainResults: DomainCalculationResult[];
  totalWeightedScores: number;
  totalMaximumPossibleScore: number;
  overallScore: number;
  calculatedAt: string;
  calculationVersion: string;
}
```

- **submissionId**: Submission identifier
- **tenantId**: Tenant identifier
- **scannerId**: Scanner used
- **scannerVersion**: Scanner version
- **submittedAt**: Submission timestamp
- **domainResults**: Array of domain results
- **totalWeightedScores**: Sum of all ΣWRS
- **totalMaximumPossibleScore**: Sum of all MPS
- **overallScore**: Weighted average across domains
- **calculatedAt**: Calculation timestamp
- **calculationVersion**: Engine version

---

## Validation Contracts

### CalculationError

```ts
interface CalculationError {
  code: 'INVALID_ANSWER' | 'INVALID_WEIGHT' | 'MISSING_RESPONSE' | 'UNKNOWN_DOMAIN' | 'INVALID_FORMULA';
  message: string;
  context?: Record<string, unknown>;
}
```

- **code**: Error category
- **message**: Human-readable message
- **context**: Additional error context

### ValidationResult

```ts
interface ValidationResult {
  valid: boolean;
  errors: CalculationError[];
}
```

- **valid**: Whether input is valid
- **errors**: Array of validation errors

---

## Formula Contracts

### FormulaNormalizer

```ts
type FormulaNormalizer = (
  sumWeightedScores: number,
  maximumPossibleScore: number
) => number;
```

Function that converts weighted scores to normalized percentage.

### FormulaRegistry

```ts
interface FormulaRegistry {
  [key: string]: FormulaNormalizer;
}
```

Map of formula type names to normalizer functions.

---

## Usage Example

```ts
import { calculateSubmission, type CalculationInput } from '@/modules/calculation';

const input: CalculationInput = {
  scanner: scannerStructure,
  submission: submissionData,
};

const result = calculateSubmission(input);

// Access domain results
result.domainResults.forEach(domain => {
  console.log(`${domain.domainName}: ${domain.normalizedScore}%`);
});

// Access overall score
console.log(`Overall: ${result.overallScore}%`);
```