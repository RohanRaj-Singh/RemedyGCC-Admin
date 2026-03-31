/**
 * Scanner Service
 * Mock data and CRUD operations for scanners
 */

import { Scanner, CreateScannerDto, UpdateScannerDto, TemplateOption, Question } from './types';
import { AttributeTemplate, GENDER_OPTIONS, AGE_RANGES } from '../attribute-template/types';

// Import templates from attribute-template service (in real app, this would be an API call)
// For now, we'll use a local mock
const mockTemplates: AttributeTemplate[] = [
  {
    id: 'attr-1',
    name: 'Default Corporate Template',
    description: 'Standard attributes for corporate employees',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    stream: [
      { id: 'tech', label: 'Technology' },
      { id: 'finance', label: 'Finance' },
      { id: 'marketing', label: 'Marketing' },
    ],
    location: [
      { id: 'us', label: 'United States' },
      { id: 'uk', label: 'United Kingdom' },
      { id: 'in', label: 'India' },
    ],
    function: [],
    department: [],
    seniority: [],
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  },
  {
    id: 'attr-2',
    name: 'Tech Startup Template',
    description: 'Attributes for tech startup employees',
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
    stream: [
      { id: 'engineering', label: 'Engineering' },
      { id: 'product', label: 'Product' },
      { id: 'design', label: 'Design' },
    ],
    location: [
      { id: 'sf', label: 'San Francisco' },
      { id: 'ny', label: 'New York' },
      { id: 'remote', label: 'Remote' },
    ],
    function: [],
    department: [],
    seniority: [],
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  },
];

// Mock scanners data
let scanners: Scanner[] = [
  {
    id: 'scanner-1',
    name: 'Employee Satisfaction Survey',
    description: 'Annual employee satisfaction survey',
    templateId: 'attr-1',
    templateName: 'Default Corporate Template',
    status: 'published',
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
    questions: [
      {
        id: 'q1',
        text: 'How satisfied are you with your work environment?',
        options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'],
        weight: 25,
      },
      {
        id: 'q2',
        text: 'How would you rate your work-life balance?',
        options: ['Excellent', 'Good', 'Fair', 'Poor'],
        weight: 25,
      },
      {
        id: 'q3',
        text: 'Do you feel valued at work?',
        options: ['Yes', 'No', 'Sometimes'],
        weight: 25,
      },
      {
        id: 'q4',
        text: 'Would you recommend this company to others?',
        options: ['Definitely', 'Probably', 'Not Sure', 'Probably Not', 'Definitely Not'],
        weight: 25,
      },
    ],
  },
  {
    id: 'scanner-2',
    name: 'Product Feedback Survey',
    description: 'Customer product feedback collection',
    templateId: 'attr-2',
    templateName: 'Tech Startup Template',
    status: 'draft',
    createdAt: '2024-02-15T10:00:00Z',
    updatedAt: '2024-02-15T10:00:00Z',
    questions: [
      {
        id: 'q1',
        text: 'How easy is our product to use?',
        options: ['Very Easy', 'Easy', 'Neutral', 'Difficult', 'Very Difficult'],
        weight: 33,
      },
      {
        id: 'q2',
        text: 'How likely are you to continue using our product?',
        options: ['Very Likely', 'Likely', 'Neutral', 'Unlikely', 'Very Unlikely'],
        weight: 33,
      },
      {
        id: 'q3',
        text: 'What is your overall satisfaction with our product?',
        options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'],
        weight: 34,
      },
    ],
  },
  {
    id: 'scanner-3',
    name: 'Team Performance Review',
    description: 'Quarterly team performance assessment',
    templateId: 'attr-1',
    templateName: 'Default Corporate Template',
    status: 'archived',
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    questions: [
      {
        id: 'q1',
        text: 'How would you rate your team collaboration?',
        options: ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'],
        weight: 50,
      },
      {
        id: 'q2',
        text: 'Did your team meet its quarterly goals?',
        options: ['Yes, Exceeded', 'Yes, Met', 'Partially Met', 'Not Met'],
        weight: 50,
      },
    ],
  },
];

/**
 * Get all scanners
 */
export async function getScanners(): Promise<Scanner[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return [...scanners];
}

/**
 * Get scanner by ID
 */
export async function getScannerById(id: string): Promise<Scanner | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return scanners.find(s => s.id === id) || null;
}

/**
 * Get all available templates for selection
 */
export async function getTemplates(): Promise<TemplateOption[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockTemplates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    fieldCount: t.stream.length + t.location.length + t.seniority.length,
  }));
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: string): Promise<AttributeTemplate | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockTemplates.find(t => t.id === id) || null;
}

/**
 * Create a new scanner
 */
export async function createScanner(data: CreateScannerDto): Promise<Scanner> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const template = mockTemplates.find(t => t.id === data.templateId);
  
  const newScanner: Scanner = {
    id: `scanner-${Date.now()}`,
    name: data.name,
    description: data.description,
    templateId: data.templateId,
    templateName: template?.name || 'Unknown Template',
    questions: data.questions.map((q, index) => ({
      ...q,
      id: `q-${Date.now()}-${index}`,
    })),
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  scanners.push(newScanner);
  return newScanner;
}

/**
 * Update an existing scanner
 */
export async function updateScanner(id: string, data: UpdateScannerDto): Promise<Scanner | null> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const index = scanners.findIndex(s => s.id === id);
  if (index === -1) return null;
  
  const existing = scanners[index];
  const updated: Scanner = {
    ...existing,
    name: data.name ?? existing.name,
    description: data.description ?? existing.description,
    questions: data.questions ? data.questions.map((q, i) => ({ ...q, id: existing.questions[i]?.id || `q-${Date.now()}-${i}` })) : existing.questions,
    status: data.status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };
  
  scanners[index] = updated;
  return updated;
}

/**
 * Delete a scanner
 */
export async function deleteScanner(id: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const index = scanners.findIndex(s => s.id === id);
  if (index === -1) return false;
  
  scanners.splice(index, 1);
  return true;
}

/**
 * Publish a scanner
 */
export async function publishScanner(id: string): Promise<Scanner | null> {
  return updateScanner(id, { status: 'published' });
}
