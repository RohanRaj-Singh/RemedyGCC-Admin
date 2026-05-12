import {
  DEFAULT_QUESTION_TYPES,
  type AttributeTemplate,
  type DepartmentOption,
  type FieldOption,
  type FunctionOption,
  type LocationOption,
} from './types';

export interface AttributeTemplateValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  blocking: boolean;
}

export interface AttributeTemplateHierarchyInput {
  stream: FieldOption[];
  location: LocationOption[];
  function: FunctionOption[];
  department: DepartmentOption[];
  seniority?: FieldOption[];
}

export interface AttributeTemplateHierarchyMaps {
  streamsById: Map<string, FieldOption>;
  locationsById: Map<string, LocationOption>;
  functionsById: Map<string, FunctionOption>;
  locationsByStreamId: Map<string, LocationOption[]>;
  functionsByLocationId: Map<string, FunctionOption[]>;
  departmentsByFunctionId: Map<string, DepartmentOption[]>;
}

function sanitizeLabel(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeIdentifier(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function slugifyToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFallbackId(prefix: string, label: string, index: number, parentId?: string): string {
  const slug = slugifyToken(label);
  const core = slug || `${prefix}-${index + 1}`;

  return parentId ? `${parentId}-${core}` : core;
}

function normalizeFieldOptions(
  options: FieldOption[],
  prefix: 'stream' | 'seniority',
): FieldOption[] {
  return options.map((option, index) => {
    const label = sanitizeLabel(option.label);
    return {
      id: normalizeIdentifier(option.id) || buildFallbackId(prefix, label, index),
      label,
      questionType: option.questionType ?? DEFAULT_QUESTION_TYPES[prefix],
    };
  });
}

function normalizeLocationOptions(options: LocationOption[]): LocationOption[] {
  return options.map((option, index) => {
    const label = sanitizeLabel(option.label);
    const streamId = normalizeIdentifier(option.streamId);

    return {
      id: normalizeIdentifier(option.id) || buildFallbackId('location', label, index, streamId || undefined),
      label,
      streamId,
      questionType: option.questionType ?? DEFAULT_QUESTION_TYPES.location,
    };
  });
}

function normalizeFunctionOptions(options: FunctionOption[]): FunctionOption[] {
  return options.map((option, index) => {
    const label = sanitizeLabel(option.label);
    const locationId = normalizeIdentifier(option.locationId);

    return {
      id: normalizeIdentifier(option.id) || buildFallbackId('function', label, index, locationId || undefined),
      label,
      locationId,
      questionType: option.questionType ?? DEFAULT_QUESTION_TYPES.function,
    };
  });
}

function normalizeDepartmentOptions(options: DepartmentOption[]): DepartmentOption[] {
  return options.map((option, index) => {
    const label = sanitizeLabel(option.label);
    const functionId = normalizeIdentifier(option.functionId);

    return {
      id: normalizeIdentifier(option.id) || buildFallbackId('department', label, index, functionId || undefined),
      label,
      functionId,
      questionType: option.questionType ?? DEFAULT_QUESTION_TYPES.department,
    };
  });
}

export function formatHierarchyPath(labels: Array<string | null | undefined>): string {
  return labels
    .map((label) => sanitizeLabel(label))
    .filter(Boolean)
    .join(' -> ');
}

export function createAttributeOptionId(parentId: string, label: string): string {
  return buildFallbackId('option', sanitizeLabel(label), 0, normalizeIdentifier(parentId) || undefined);
}

export function normalizeAttributeTemplateHierarchy(
  input: AttributeTemplateHierarchyInput,
): Required<AttributeTemplateHierarchyInput> {
  return {
    stream: normalizeFieldOptions(input.stream ?? [], 'stream'),
    location: normalizeLocationOptions(input.location ?? []),
    function: normalizeFunctionOptions(input.function ?? []),
    department: normalizeDepartmentOptions(input.department ?? []),
    seniority: normalizeFieldOptions(input.seniority ?? [], 'seniority'),
  };
}

export function pruneAttributeTemplateHierarchy(
  input: AttributeTemplateHierarchyInput,
): Required<AttributeTemplateHierarchyInput> {
  const normalized = normalizeAttributeTemplateHierarchy(input);
  const streamIds = new Set(normalized.stream.map((item) => item.id));
  const nextLocations = normalized.location.filter((item) => streamIds.has(item.streamId));
  const locationIds = new Set(nextLocations.map((item) => item.id));
  const nextFunctions = normalized.function.filter((item) => locationIds.has(item.locationId));
  const functionIds = new Set(nextFunctions.map((item) => item.id));
  const nextDepartments = normalized.department.filter((item) => functionIds.has(item.functionId));

  return {
    ...normalized,
    location: nextLocations,
    function: nextFunctions,
    department: nextDepartments,
  };
}

export function buildAttributeTemplateHierarchyMaps(
  input: AttributeTemplateHierarchyInput,
): AttributeTemplateHierarchyMaps {
  const normalized = normalizeAttributeTemplateHierarchy(input);
  const maps: AttributeTemplateHierarchyMaps = {
    streamsById: new Map(normalized.stream.map((item) => [item.id, item])),
    locationsById: new Map(normalized.location.map((item) => [item.id, item])),
    functionsById: new Map(normalized.function.map((item) => [item.id, item])),
    locationsByStreamId: new Map(),
    functionsByLocationId: new Map(),
    departmentsByFunctionId: new Map(),
  };

  normalized.location.forEach((item) => {
    maps.locationsByStreamId.set(item.streamId, [
      ...(maps.locationsByStreamId.get(item.streamId) ?? []),
      item,
    ]);
  });

  normalized.function.forEach((item) => {
    maps.functionsByLocationId.set(item.locationId, [
      ...(maps.functionsByLocationId.get(item.locationId) ?? []),
      item,
    ]);
  });

  normalized.department.forEach((item) => {
    maps.departmentsByFunctionId.set(item.functionId, [
      ...(maps.departmentsByFunctionId.get(item.functionId) ?? []),
      item,
    ]);
  });

  return maps;
}

export function getLocationLineage(
  location: LocationOption,
  maps: AttributeTemplateHierarchyMaps,
): string[] {
  const stream = maps.streamsById.get(location.streamId);
  return [stream?.label, location.label].filter(Boolean) as string[];
}

export function getFunctionLineage(
  func: FunctionOption,
  maps: AttributeTemplateHierarchyMaps,
): string[] {
  const location = maps.locationsById.get(func.locationId);
  const stream = location ? maps.streamsById.get(location.streamId) : null;
  return [stream?.label, location?.label, func.label].filter(Boolean) as string[];
}

export function getDepartmentLineage(
  department: DepartmentOption,
  maps: AttributeTemplateHierarchyMaps,
): string[] {
  const func = maps.functionsById.get(department.functionId);
  const location = func ? maps.locationsById.get(func.locationId) : null;
  const stream = location ? maps.streamsById.get(location.streamId) : null;
  return [stream?.label, location?.label, func?.label, department.label].filter(Boolean) as string[];
}

function pushIssue(
  issues: AttributeTemplateValidationIssue[],
  issue: AttributeTemplateValidationIssue,
) {
  issues.push(issue);
}

function pushDuplicateIdIssues(
  issues: AttributeTemplateValidationIssue[],
  items: FieldOption[],
  level: 'stream' | 'location' | 'function' | 'department' | 'seniority',
) {
  const seen = new Map<string, FieldOption>();

  items.forEach((item) => {
    const existing = seen.get(item.id);
    if (existing) {
      pushIssue(issues, {
        code: `ATTRIBUTE_${level.toUpperCase()}_ID_DUPLICATE`,
        path: `attributeTemplate.${level}.${item.id}.id`,
        message: `${level[0].toUpperCase() + level.slice(1)} id "${item.id}" is duplicated.`,
        severity: 'error',
        blocking: true,
      });
      return;
    }

    seen.set(item.id, item);
  });
}

function pushDuplicateLabelIssues<T extends FieldOption>(
  issues: AttributeTemplateValidationIssue[],
  items: T[],
  level: 'stream' | 'location' | 'function' | 'department' | 'seniority',
  getScopeKey: (item: T) => string,
  getContextLabel: (item: T) => string | null,
) {
  const seen = new Map<string, T>();

  items.forEach((item) => {
    const labelKey = sanitizeLabel(item.label).toLowerCase();
    if (!labelKey) {
      pushIssue(issues, {
        code: `ATTRIBUTE_${level.toUpperCase()}_LABEL_REQUIRED`,
        path: `attributeTemplate.${level}.${item.id}.label`,
        message: `${level[0].toUpperCase() + level.slice(1)} labels cannot be empty.`,
        severity: 'error',
        blocking: true,
      });
      return;
    }

    const scopedKey = `${getScopeKey(item)}::${labelKey}`;
    const existing = seen.get(scopedKey);
    if (existing) {
      const contextLabel = getContextLabel(item);
      pushIssue(issues, {
        code: `ATTRIBUTE_${level.toUpperCase()}_LABEL_DUPLICATE`,
        path: `attributeTemplate.${level}.${item.id}.label`,
        message: contextLabel
          ? `${level[0].toUpperCase() + level.slice(1)} label "${item.label}" is duplicated inside ${contextLabel}.`
          : `${level[0].toUpperCase() + level.slice(1)} label "${item.label}" is duplicated.`,
        severity: 'error',
        blocking: true,
      });
      return;
    }

    seen.set(scopedKey, item);
  });
}

export function validateAttributeTemplateHierarchy(
  input: AttributeTemplateHierarchyInput | AttributeTemplate | null,
): AttributeTemplateValidationIssue[] {
  const issues: AttributeTemplateValidationIssue[] = [];

  if (!input) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_TEMPLATE_REQUIRED',
      path: 'attributeTemplate',
      message: 'Attribute template is required.',
      severity: 'error',
      blocking: true,
    });
    return issues;
  }

  const normalized = normalizeAttributeTemplateHierarchy(input);
  const maps = buildAttributeTemplateHierarchyMaps(normalized);

  if (normalized.stream.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_STREAM_REQUIRED',
      path: 'attributeTemplate.stream',
      message: 'Attribute template must contain at least one stream.',
      severity: 'error',
      blocking: true,
    });
  }

  if (normalized.location.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_LOCATION_REQUIRED',
      path: 'attributeTemplate.location',
      message: 'Attribute template must contain at least one location.',
      severity: 'error',
      blocking: true,
    });
  }

  if (normalized.function.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_FUNCTION_REQUIRED',
      path: 'attributeTemplate.function',
      message: 'Attribute template must contain at least one function.',
      severity: 'error',
      blocking: true,
    });
  }

  if (normalized.department.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_DEPARTMENT_REQUIRED',
      path: 'attributeTemplate.department',
      message: 'Attribute template must contain at least one department.',
      severity: 'error',
      blocking: true,
    });
  }

  pushDuplicateIdIssues(issues, normalized.stream, 'stream');
  pushDuplicateIdIssues(issues, normalized.location, 'location');
  pushDuplicateIdIssues(issues, normalized.function, 'function');
  pushDuplicateIdIssues(issues, normalized.department, 'department');
  pushDuplicateIdIssues(issues, normalized.seniority, 'seniority');

  pushDuplicateLabelIssues(issues, normalized.stream, 'stream', () => 'stream-root', () => null);
  pushDuplicateLabelIssues(issues, normalized.location, 'location', (item) => item.streamId, (item) => {
    const stream = maps.streamsById.get(item.streamId);
    return stream ? `stream "${stream.label}"` : 'an invalid stream scope';
  });
  pushDuplicateLabelIssues(issues, normalized.function, 'function', (item) => item.locationId, (item) => {
    const location = maps.locationsById.get(item.locationId);
    return location
      ? `"${formatHierarchyPath(getLocationLineage(location, maps))}"`
      : 'an invalid location scope';
  });
  pushDuplicateLabelIssues(issues, normalized.department, 'department', (item) => item.functionId, (item) => {
    const func = maps.functionsById.get(item.functionId);
    return func
      ? `"${formatHierarchyPath(getFunctionLineage(func, maps))}"`
      : 'an invalid function scope';
  });
  pushDuplicateLabelIssues(issues, normalized.seniority, 'seniority', () => 'seniority-root', () => null);

  normalized.location.forEach((item) => {
    if (!maps.streamsById.has(item.streamId)) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_LOCATION_PARENT_INVALID',
        path: `attributeTemplate.location.${item.id}.streamId`,
        message: `Location "${item.label}" must belong to a valid stream.`,
        severity: 'error',
        blocking: true,
      });
    }
  });

  normalized.function.forEach((item) => {
    if (!maps.locationsById.has(item.locationId)) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_FUNCTION_PARENT_INVALID',
        path: `attributeTemplate.function.${item.id}.locationId`,
        message: `Function "${item.label}" must belong to a valid location.`,
        severity: 'error',
        blocking: true,
      });
    }
  });

  normalized.department.forEach((item) => {
    if (!maps.functionsById.has(item.functionId)) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_DEPARTMENT_PARENT_INVALID',
        path: `attributeTemplate.department.${item.id}.functionId`,
        message: `Department "${item.label}" must belong to a valid function.`,
        severity: 'error',
        blocking: true,
      });
    }
  });

  normalized.stream.forEach((item) => {
    const linkedLocations = maps.locationsByStreamId.get(item.id) ?? [];
    if (linkedLocations.length === 0) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_STREAM_LOCATION_MISSING',
        path: `attributeTemplate.stream.${item.id}`,
        message: `Stream "${item.label}" has no linked locations.`,
        severity: 'error',
        blocking: true,
      });
    }
  });

  normalized.location.forEach((item) => {
    const linkedFunctions = maps.functionsByLocationId.get(item.id) ?? [];
    if (linkedFunctions.length === 0) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_LOCATION_FUNCTION_MISSING',
        path: `attributeTemplate.location.${item.id}`,
        message: `Location "${item.label}" inside ${formatHierarchyPath(getLocationLineage(item, maps))} has no linked functions.`,
        severity: 'error',
        blocking: true,
      });
    }
  });

  normalized.function.forEach((item) => {
    const linkedDepartments = maps.departmentsByFunctionId.get(item.id) ?? [];
    if (linkedDepartments.length === 0) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_FUNCTION_DEPARTMENT_MISSING',
        path: `attributeTemplate.function.${item.id}`,
        message: `Function "${item.label}" inside ${formatHierarchyPath(getFunctionLineage(item, maps))} has no linked departments.`,
        severity: 'error',
        blocking: true,
      });
    }
  });

  const hasCompletePath = normalized.function.some((item) => {
    const location = maps.locationsById.get(item.locationId);
    const stream = location ? maps.streamsById.get(location.streamId) : null;
    return Boolean(stream && location && (maps.departmentsByFunctionId.get(item.id) ?? []).length > 0);
  });

  if (!hasCompletePath) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_HIERARCHY_CHAIN_REQUIRED',
      path: 'attributeTemplate',
      message: 'Attribute template must contain at least one complete Stream -> Location -> Function -> Department chain.',
      severity: 'error',
      blocking: true,
    });
  }

  return issues;
}
