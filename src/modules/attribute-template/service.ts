/**
 * Attribute Template Service
 * CRUD operations for linked attribute templates using MongoDB persistence.
 */

'use server';

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
import {
  deleteAttributeTemplateDocument,
  getAllAttributeTemplatesData,
  getAttributeTemplateByIdData,
  insertAttributeTemplateDocument,
  updateAttributeTemplateDocument,
} from '@/server/attribute-template/repository';

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

export async function getAllTemplates(): Promise<AttributeTemplate[]> {
  const templates = await getAllAttributeTemplatesData();
  return templates.map((template) => normalizeTemplateRecord(template));
}

export async function getTemplateById(id: string): Promise<AttributeTemplate | null> {
  const template = await getAttributeTemplateByIdData(id);
  return template ? normalizeTemplateRecord(template) : null;
}

export async function createTemplate(data: CreateAttributeTemplateDto): Promise<AttributeTemplate> {
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

  const result = await insertAttributeTemplateDocument(newTemplate);
  return normalizeTemplateRecord(result);
}

export async function updateTemplate(data: UpdateAttributeTemplateDto): Promise<AttributeTemplate> {
  const existing = await getAttributeTemplateByIdData(data.id);
  if (!existing) {
    throw new Error(`Template with id ${data.id} not found`);
  }

  const merged = {
    stream: data.stream ?? existing.stream,
    location: data.location ?? existing.location,
    function: data.function ?? existing.function,
    department: data.department ?? existing.department,
    seniority: data.seniority ?? existing.seniority,
  };
  const normalized = assertValidHierarchy(merged);

  const updated: AttributeTemplate = {
    ...existing,
    ...data,
    stream: clone(normalized.stream),
    location: clone(normalized.location),
    function: clone(normalized.function),
    department: clone(normalized.department),
    seniority: clone(normalized.seniority),
    updatedAt: new Date().toISOString(),
  };

  const result = await updateAttributeTemplateDocument(data.id, normalizeTemplateRecord(updated));
  if (!result) {
    throw new Error(`Failed to update template with id ${data.id}`);
  }
  return normalizeTemplateRecord(result);
}

export async function deleteTemplate(id: string): Promise<void> {
  const existing = await getAttributeTemplateByIdData(id);
  if (!existing) {
    throw new Error(`Template with id ${id} not found`);
  }

  await deleteAttributeTemplateDocument(id);
}

export async function getDepartments(
  templateId: string,
  functionId?: string
): Promise<{ id: string; label: string; functionId: string }[]> {
  const template = await getAttributeTemplateByIdData(templateId);
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