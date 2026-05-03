/**
 * Attribute Template Service
 * Mock data and CRUD operations for linked attribute templates.
 */

import {
  AGE_RANGES,
  AttributeTemplate,
  CreateAttributeTemplateDto,
  DEFAULT_QUESTION_TYPES,
  GENDER_OPTIONS,
  QuestionType,
  UpdateAttributeTemplateDto,
} from './types';

let templates: AttributeTemplate[] = [
  {
    id: 'attr-1',
    name: 'Default Corporate Template',
    description: 'Standard linked attribute hierarchy for enterprise tenants',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    stream: [
      { id: 'tech', label: 'Technology', questionType: DEFAULT_QUESTION_TYPES.stream },
      { id: 'finance', label: 'Finance', questionType: DEFAULT_QUESTION_TYPES.stream },
      { id: 'hr', label: 'Human Resources', questionType: DEFAULT_QUESTION_TYPES.stream },
    ],
    location: [
      { id: 'tech-us', label: 'Technology - US', streamId: 'tech', questionType: DEFAULT_QUESTION_TYPES.location },
      { id: 'tech-in', label: 'Technology - India', streamId: 'tech', questionType: DEFAULT_QUESTION_TYPES.location },
      { id: 'finance-uk', label: 'Finance - UK', streamId: 'finance', questionType: DEFAULT_QUESTION_TYPES.location },
      { id: 'hr-uae', label: 'HR - UAE', streamId: 'hr', questionType: DEFAULT_QUESTION_TYPES.location },
    ],
    function: [
      { id: 'tech-platform', label: 'Platform Engineering', locationId: 'tech-us', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'tech-support', label: 'Technical Support', locationId: 'tech-in', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'finance-controls', label: 'Financial Controls', locationId: 'finance-uk', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'hr-peopleops', label: 'People Operations', locationId: 'hr-uae', questionType: DEFAULT_QUESTION_TYPES.function },
    ],
    department: [
      { id: 'backend', label: 'Backend', functionId: 'tech-platform', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'frontend', label: 'Frontend', functionId: 'tech-platform', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'helpdesk', label: 'Helpdesk', functionId: 'tech-support', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'compliance', label: 'Compliance', functionId: 'finance-controls', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'talent', label: 'Talent Acquisition', functionId: 'hr-peopleops', questionType: DEFAULT_QUESTION_TYPES.department },
    ],
    seniority: [
      { id: 'junior', label: 'Junior', questionType: DEFAULT_QUESTION_TYPES.seniority },
      { id: 'mid', label: 'Mid-Level', questionType: DEFAULT_QUESTION_TYPES.seniority },
      { id: 'senior', label: 'Senior', questionType: DEFAULT_QUESTION_TYPES.seniority },
      { id: 'director', label: 'Director', questionType: DEFAULT_QUESTION_TYPES.seniority },
    ],
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  },
  {
    id: 'attr-2',
    name: 'Startup Template',
    description: 'Lightweight linked hierarchy for startup environments',
    createdAt: '2024-02-20T14:30:00Z',
    updatedAt: '2024-02-20T14:30:00Z',
    stream: [
      { id: 'product', label: 'Product', questionType: DEFAULT_QUESTION_TYPES.stream },
      { id: 'growth', label: 'Growth', questionType: DEFAULT_QUESTION_TYPES.stream },
      { id: 'ops', label: 'Operations', questionType: DEFAULT_QUESTION_TYPES.stream },
    ],
    location: [
      { id: 'product-remote', label: 'Product - Remote', streamId: 'product', questionType: DEFAULT_QUESTION_TYPES.location },
      { id: 'growth-dubai', label: 'Growth - Dubai', streamId: 'growth', questionType: DEFAULT_QUESTION_TYPES.location },
      { id: 'ops-riyadh', label: 'Operations - Riyadh', streamId: 'ops', questionType: DEFAULT_QUESTION_TYPES.location },
    ],
    function: [
      { id: 'product-core', label: 'Core Product', locationId: 'product-remote', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'growth-demand', label: 'Demand Generation', locationId: 'growth-dubai', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'ops-enablement', label: 'Enablement', locationId: 'ops-riyadh', questionType: DEFAULT_QUESTION_TYPES.function },
    ],
    department: [
      { id: 'pm', label: 'Product Management', functionId: 'product-core', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'content', label: 'Content', functionId: 'growth-demand', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'systems', label: 'Systems', functionId: 'ops-enablement', questionType: DEFAULT_QUESTION_TYPES.department },
    ],
    seniority: [
      { id: 'founder', label: 'Founder', questionType: DEFAULT_QUESTION_TYPES.seniority },
      { id: 'lead', label: 'Lead', questionType: DEFAULT_QUESTION_TYPES.seniority },
      { id: 'individual', label: 'Individual Contributor', questionType: DEFAULT_QUESTION_TYPES.seniority },
    ],
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getAllTemplates(): Promise<AttributeTemplate[]> {
  await delay(250);
  return clone(templates);
}

export async function getTemplateById(id: string): Promise<AttributeTemplate | null> {
  await delay(180);
  const template = templates.find((item) => item.id === id);
  return template ? clone(template) : null;
}

export async function createTemplate(data: CreateAttributeTemplateDto): Promise<AttributeTemplate> {
  await delay(300);

  const now = new Date().toISOString();
  const newTemplate: AttributeTemplate = {
    id: `attr-${Date.now()}`,
    name: data.name,
    description: data.description,
    createdAt: now,
    updatedAt: now,
    stream: clone(data.stream),
    location: clone(data.location),
    function: clone(data.function),
    department: clone(data.department),
    seniority: clone(data.seniority),
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  };

  templates = [newTemplate, ...templates];
  return clone(newTemplate);
}

export async function updateTemplate(data: UpdateAttributeTemplateDto): Promise<AttributeTemplate> {
  await delay(280);

  const index = templates.findIndex((template) => template.id === data.id);
  if (index === -1) {
    throw new Error(`Template with id ${data.id} not found`);
  }

  const updated: AttributeTemplate = {
    ...templates[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  templates[index] = updated;
  return clone(updated);
}

export async function deleteTemplate(id: string): Promise<void> {
  await delay(180);

  const index = templates.findIndex((template) => template.id === id);
  if (index === -1) {
    throw new Error(`Template with id ${id} not found`);
  }

  templates = templates.filter((template) => template.id !== id);
}

export async function getFunctions(
  templateId: string,
  locationId?: string
): Promise<{ id: string; label: string; locationId: string }[]> {
  await delay(120);

  const template = templates.find((item) => item.id === templateId);
  if (!template) {
    return [];
  }

  const functions = locationId
    ? template.function.filter((item) => item.locationId === locationId)
    : template.function;

  return clone(functions.map((item) => ({
    id: item.id,
    label: item.label,
    locationId: item.locationId,
  })));
}

export const attributeTemplateService = {
  getAll: getAllTemplates,
  getById: getTemplateById,
  create: createTemplate,
  update: updateTemplate,
  delete: deleteTemplate,
  getFunctions,
};
