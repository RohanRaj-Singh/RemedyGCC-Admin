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
  UpdateAttributeTemplateDto,
} from './types';
import {
  normalizeAttributeTemplateHierarchy,
  validateAttributeTemplateHierarchy,
} from './utils';

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
      { id: 'tech-us-platform', label: 'Platform Engineering', locationId: 'tech-us', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'tech-in-support', label: 'Technical Support', locationId: 'tech-in', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'finance-uk-controls', label: 'Financial Controls', locationId: 'finance-uk', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'hr-uae-peopleops', label: 'People Operations', locationId: 'hr-uae', questionType: DEFAULT_QUESTION_TYPES.function },
    ],
    department: [
      { id: 'tech-us-platform-backend', label: 'Backend', functionId: 'tech-us-platform', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'tech-us-platform-frontend', label: 'Frontend', functionId: 'tech-us-platform', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'tech-in-support-helpdesk', label: 'Helpdesk', functionId: 'tech-in-support', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'finance-uk-controls-compliance', label: 'Compliance', functionId: 'finance-uk-controls', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'hr-uae-peopleops-talent', label: 'Talent Acquisition', functionId: 'hr-uae-peopleops', questionType: DEFAULT_QUESTION_TYPES.department },
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
      { id: 'product-remote-core', label: 'Core Product', locationId: 'product-remote', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'growth-dubai-demand', label: 'Demand Generation', locationId: 'growth-dubai', questionType: DEFAULT_QUESTION_TYPES.function },
      { id: 'ops-riyadh-enablement', label: 'Enablement', locationId: 'ops-riyadh', questionType: DEFAULT_QUESTION_TYPES.function },
    ],
    department: [
      { id: 'product-remote-core-pm', label: 'Product Management', functionId: 'product-remote-core', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'growth-dubai-demand-content', label: 'Content', functionId: 'growth-dubai-demand', questionType: DEFAULT_QUESTION_TYPES.department },
      { id: 'ops-riyadh-enablement-systems', label: 'Systems', functionId: 'ops-riyadh-enablement', questionType: DEFAULT_QUESTION_TYPES.department },
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

function normalizeTemplateRecord(
  template: Omit<AttributeTemplate, 'gender' | 'age'>,
): AttributeTemplate {
  const normalized = normalizeAttributeTemplateHierarchy(template);

  return {
    ...template,
    stream: clone(normalized.stream),
    location: clone(normalized.location),
    function: clone(normalized.function),
    department: clone(normalized.department),
    seniority: clone(normalized.seniority),
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  };
}

function assertValidHierarchy(
  data: Pick<
    CreateAttributeTemplateDto,
    'stream' | 'location' | 'function' | 'department' | 'seniority'
  >,
): ReturnType<typeof normalizeAttributeTemplateHierarchy> {
  const normalized = normalizeAttributeTemplateHierarchy({
    stream: data.stream ?? [],
    location: data.location ?? [],
    function: data.function ?? [],
    department: data.department ?? [],
    seniority: data.seniority ?? [],
  });
  const issues = validateAttributeTemplateHierarchy(normalized);
  const firstBlockingIssue = issues.find((issue) => issue.blocking);

  if (firstBlockingIssue) {
    throw new Error(firstBlockingIssue.message);
  }

  return normalized;
}

templates = templates.map((template) =>
  normalizeTemplateRecord({
    ...template,
    stream: clone(template.stream),
    location: clone(template.location),
    function: clone(template.function),
    department: clone(template.department),
    seniority: clone(template.seniority),
  }),
);

export async function getAllTemplates(): Promise<AttributeTemplate[]> {
  await delay(250);
  return clone(templates.map((template) => normalizeTemplateRecord(template)));
}

export async function getTemplateById(id: string): Promise<AttributeTemplate | null> {
  await delay(180);
  const template = templates.find((item) => item.id === id);
  return template ? clone(normalizeTemplateRecord(template)) : null;
}

export async function createTemplate(data: CreateAttributeTemplateDto): Promise<AttributeTemplate> {
  await delay(300);
  const normalized = assertValidHierarchy(data);

  const now = new Date().toISOString();
  const newTemplate: AttributeTemplate = {
    id: `attr-${Date.now()}`,
    name: data.name,
    description: data.description,
    createdAt: now,
    updatedAt: now,
    stream: clone(normalized.stream),
    location: clone(normalized.location),
    function: clone(normalized.function),
    department: clone(normalized.department),
    seniority: clone(normalized.seniority),
    gender: GENDER_OPTIONS,
    age: AGE_RANGES,
  };

  templates = [newTemplate, ...templates];
  return clone(normalizeTemplateRecord(newTemplate));
}

export async function updateTemplate(data: UpdateAttributeTemplateDto): Promise<AttributeTemplate> {
  await delay(280);

  const index = templates.findIndex((template) => template.id === data.id);
  if (index === -1) {
    throw new Error(`Template with id ${data.id} not found`);
  }

  const merged = {
    stream: data.stream ?? templates[index].stream,
    location: data.location ?? templates[index].location,
    function: data.function ?? templates[index].function,
    department: data.department ?? templates[index].department,
    seniority: data.seniority ?? templates[index].seniority,
  };
  const normalized = assertValidHierarchy(merged);

  const updated: AttributeTemplate = {
    ...templates[index],
    ...data,
    stream: clone(normalized.stream),
    location: clone(normalized.location),
    function: clone(normalized.function),
    department: clone(normalized.department),
    seniority: clone(normalized.seniority),
    updatedAt: new Date().toISOString(),
  };

  templates[index] = normalizeTemplateRecord(updated);
  return clone(templates[index]);
}

export async function deleteTemplate(id: string): Promise<void> {
  await delay(180);

  const index = templates.findIndex((template) => template.id === id);
  if (index === -1) {
    throw new Error(`Template with id ${id} not found`);
  }

  templates = templates.filter((template) => template.id !== id);
}

export async function getDepartments(
  templateId: string,
  functionId?: string
): Promise<{ id: string; label: string; functionId: string }[]> {
  await delay(120);

  const template = templates.find((item) => item.id === templateId);
  if (!template) {
    return [];
  }

  const departments = functionId
    ? template.department.filter((item) => item.functionId === functionId)
    : template.department;

  return clone(departments.map((item) => ({
    id: item.id,
    label: item.label,
    functionId: item.functionId,
  })));
}

export const attributeTemplateService = {
  getAll: getAllTemplates,
  getById: getTemplateById,
  create: createTemplate,
  update: updateTemplate,
  delete: deleteTemplate,
  getDepartments,
};
