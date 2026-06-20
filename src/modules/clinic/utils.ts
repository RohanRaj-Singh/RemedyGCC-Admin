import type { ClinicStatus } from './types';

export function normalizeClinicSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateClinicSlug(slug: string): { normalized: string; errors: string[] } {
  const normalized = normalizeClinicSlugInput(slug);
  const errors: string[] = [];

  if (!normalized) {
    errors.push('Clinic slug is required.');
    return { normalized, errors };
  }

  if (normalized.length < 2) {
    errors.push('Clinic slug must be at least 2 characters.');
  }

  if (normalized.length > 100) {
    errors.push('Clinic slug must be at most 100 characters.');
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(normalized)) {
    errors.push('Clinic slug must start and end with a letter or number.');
  }

  return { normalized, errors };
}

export function validateClinicName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Clinic name is required.';
  if (trimmed.length > 200) return 'Clinic name must be at most 200 characters.';
  return null;
}

export function validateClinicStatusTransition(
  currentStatus: ClinicStatus,
  nextStatus: ClinicStatus,
): string | null {
  if (currentStatus === nextStatus) return null;

  const allowed: Record<ClinicStatus, ClinicStatus[]> = {
    active: ['inactive'],
    inactive: ['active', 'archived'],
    archived: [],
  };

  if (!allowed[currentStatus].includes(nextStatus)) {
    return `Cannot transition from "${currentStatus}" to "${nextStatus}".`;
  }

  return null;
}

export function getClinicStatusMeta(status: ClinicStatus): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#15803d', bg: 'rgba(34, 197, 94, 0.12)' };
    case 'inactive':
      return { label: 'Inactive', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' };
    case 'archived':
      return { label: 'Archived', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
  }
}

export function createClinicId(slug: string): string {
  const ts = Date.now().toString(36);
  return `clinic-${slug}-${ts}`;
}
