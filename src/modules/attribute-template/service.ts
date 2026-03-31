/**
 * Attribute Template Service
 * Mock data and CRUD operations for attribute templates
 */

import {
  AttributeTemplate,
  CreateAttributeTemplateDto,
  UpdateAttributeTemplateDto,
  GENDER_OPTIONS,
  AGE_RANGES,
  DEFAULT_QUESTION_TYPES,
  QuestionType,
} from './types';

// Mock data storage
let templates: AttributeTemplate[] = [
  {
    id: 'attr-1',
    name: 'Default Corporate Template',
    description: 'Standard attributes for corporate employees',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    
    // Editable fields
    stream: [
      { id: 'tech', label: 'Technology', questionType: 'dropdown' as QuestionType },
      { id: 'finance', label: 'Finance', questionType: 'dropdown' as QuestionType },
      { id: 'marketing', label: 'Marketing', questionType: 'dropdown' as QuestionType },
      { id: 'hr', label: 'Human Resources', questionType: 'dropdown' as QuestionType },
      { id: 'operations', label: 'Operations', questionType: 'dropdown' as QuestionType },
    ],
    location: [
      { id: 'us', label: 'United States', questionType: 'dropdown' as QuestionType },
      { id: 'uk', label: 'United Kingdom', questionType: 'dropdown' as QuestionType },
      { id: 'in', label: 'India', questionType: 'dropdown' as QuestionType },
      { id: 'de', label: 'Germany', questionType: 'dropdown' as QuestionType },
      { id: 'jp', label: 'Japan', questionType: 'dropdown' as QuestionType },
    ],
    function: [
      { id: 'eng-engineering', label: 'Engineering', departmentId: 'eng-backend', questionType: 'dropdown' as QuestionType },
      { id: 'eng-sales', label: 'Sales', departmentId: 'eng-backend', questionType: 'dropdown' as QuestionType },
      { id: 'eng-support', label: 'Customer Support', departmentId: 'eng-backend', questionType: 'dropdown' as QuestionType },
      { id: 'eng-product', label: 'Product', departmentId: 'eng-frontend', questionType: 'dropdown' as QuestionType },
      { id: 'eng-design', label: 'Design', departmentId: 'eng-frontend', questionType: 'dropdown' as QuestionType },
    ],
    // Departments linked to streams
    department: [
      { id: 'eng-backend', label: 'Backend', streamId: 'tech', questionType: 'dropdown' as QuestionType },
      { id: 'eng-frontend', label: 'Frontend', streamId: 'tech', questionType: 'dropdown' as QuestionType },
      { id: 'eng-devops', label: 'DevOps', streamId: 'tech', questionType: 'dropdown' as QuestionType },
      { id: 'fin-accounting', label: 'Accounting', streamId: 'finance', questionType: 'dropdown' as QuestionType },
      { id: 'fin-analytics', label: 'Financial Analytics', streamId: 'finance', questionType: 'dropdown' as QuestionType },
      { id: 'mkt-digital', label: 'Digital Marketing', streamId: 'marketing', questionType: 'dropdown' as QuestionType },
      { id: 'mkt-brand', label: 'Brand Marketing', streamId: 'marketing', questionType: 'dropdown' as QuestionType },
      { id: 'hr-recruit', label: 'Recruitment', streamId: 'hr', questionType: 'dropdown' as QuestionType },
      { id: 'hr-training', label: 'Training & Development', streamId: 'hr', questionType: 'dropdown' as QuestionType },
      { id: 'ops-logistics', label: 'Logistics', streamId: 'operations', questionType: 'dropdown' as QuestionType },
    ],
    seniority: [
      { id: 'intern', label: 'Intern', questionType: 'radio' as QuestionType },
      { id: 'junior', label: 'Junior', questionType: 'radio' as QuestionType },
      { id: 'mid', label: 'Mid-Level', questionType: 'radio' as QuestionType },
      { id: 'senior', label: 'Senior', questionType: 'radio' as QuestionType },
      { id: 'lead', label: 'Lead', questionType: 'radio' as QuestionType },
      { id: 'manager', label: 'Manager', questionType: 'radio' as QuestionType },
      { id: 'director', label: 'Director', questionType: 'radio' as QuestionType },
      { id: 'vp', label: 'VP', questionType: 'radio' as QuestionType },
      { id: 'cxo', label: 'CXO', questionType: 'radio' as QuestionType },
    ],
    
    // Fixed fields
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  },
  {
    id: 'attr-2',
    name: 'Startup Template',
    description: 'Simplified attributes for startup environments',
    createdAt: '2024-02-20T14:30:00Z',
    updatedAt: '2024-02-20T14:30:00Z',
    
    stream: [
      { id: 'product', label: 'Product', questionType: 'dropdown' as QuestionType },
      { id: 'growth', label: 'Growth', questionType: 'dropdown' as QuestionType },
      { id: 'tech', label: 'Technology', questionType: 'dropdown' as QuestionType },
    ],
    location: [
      { id: 'sf', label: 'San Francisco', questionType: 'dropdown' as QuestionType },
      { id: 'nyc', label: 'New York', questionType: 'dropdown' as QuestionType },
      { id: 'remote', label: 'Remote', questionType: 'dropdown' as QuestionType },
    ],
    function: [
      { id: 'st-eng', label: 'Engineering', departmentId: 'eng-fullstack', questionType: 'dropdown' as QuestionType },
      { id: 'st-mkt', label: 'Marketing', departmentId: 'growth-growth', questionType: 'dropdown' as QuestionType },
      { id: 'st-sales', label: 'Sales', departmentId: 'growth-growth', questionType: 'dropdown' as QuestionType },
    ],
    department: [
      { id: 'eng-fullstack', label: 'Full Stack', streamId: 'tech', questionType: 'dropdown' as QuestionType },
      { id: 'growth-growth', label: 'Growth Marketing', streamId: 'growth', questionType: 'dropdown' as QuestionType },
      { id: 'prod-product', label: 'Product Management', streamId: 'product', questionType: 'dropdown' as QuestionType },
    ],
    seniority: [
      { id: 'founder', label: 'Founder', questionType: 'radio' as QuestionType },
      { id: 'co-founder', label: 'Co-Founder', questionType: 'radio' as QuestionType },
      { id: 'employee', label: 'Employee', questionType: 'radio' as QuestionType },
    ],
    
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  },
];

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get all attribute templates
 */
export async function getAllTemplates(): Promise<AttributeTemplate[]> {
  await delay(300);
  return [...templates];
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(id: string): Promise<AttributeTemplate | null> {
  await delay(200);
  const template = templates.find(t => t.id === id);
  return template || null;
}

/**
 * Create a new attribute template
 */
export async function createTemplate(
  data: CreateAttributeTemplateDto
): Promise<AttributeTemplate> {
  await delay(400);
  
  const now = new Date().toISOString();
  const newTemplate: AttributeTemplate = {
    id: `attr-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    name: data.name,
    description: data.description,
    stream: data.stream,
    location: data.location,
    function: data.function,
    department: data.department,
    seniority: data.seniority,
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  };
  
  templates.push(newTemplate);
  return newTemplate;
}

/**
 * Update an existing attribute template
 */
export async function updateTemplate(
  data: UpdateAttributeTemplateDto
): Promise<AttributeTemplate> {
  await delay(300);
  
  const index = templates.findIndex(t => t.id === data.id);
  if (index === -1) {
    throw new Error(`Template with id ${data.id} not found`);
  }
  
  const updated: AttributeTemplate = {
    ...templates[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  
  templates[index] = updated;
  return updated;
}

/**
 * Delete an attribute template
 */
export async function deleteTemplate(id: string): Promise<void> {
  await delay(200);
  
  const index = templates.findIndex(t => t.id === id);
  if (index === -1) {
    throw new Error(`Template with id ${id} not found`);
  }
  
  templates.splice(index, 1);
}

/**
 * Get functions filtered by department
 */
export async function getFunctions(
  templateId: string, 
  departmentId?: string
): Promise<{ id: string; label: string; departmentId: string }[]> {
  await delay(100);
  
  const template = templates.find(t => t.id === templateId);
  if (!template) {
    return [];
  }
  
  let functions = template.function;
  
  if (departmentId) {
    functions = functions.filter(f => f.departmentId === departmentId);
  }
  
  return functions.map(f => ({
    id: f.id,
    label: f.label,
    departmentId: f.departmentId,
  }));
}

// Export service object for consistency
export const attributeTemplateService = {
  getAll: getAllTemplates,
  getById: getTemplateById,
  create: createTemplate,
  update: updateTemplate,
  delete: deleteTemplate,
  getFunctions,
};
