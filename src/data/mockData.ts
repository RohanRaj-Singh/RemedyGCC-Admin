/**
 * Centralized Dummy Data for Super Admin Dashboard
 * This data simulates what will later be fetched from the Laravel API
 * Use this to design API contracts and test UI components
 */

import {
  Tenant,
  Scanner,
  SystemLog,
  DashboardStats,
  BrandingConfig,
} from '../types';

export { DEFAULT_BRANDING } from '../types/branding';

const HEALTHFIRST_BRANDING: BrandingConfig = {
  appName: 'HealthFirst Clinic',
  logoUrl: '/logos/healthfirst.svg',
  faviconUrl: '/logos/healthfirst-favicon.ico',
  primaryColor: '#2563eb',
  secondaryColor: '#38bdf8',

};

const WELLNESS_BRANDING: BrandingConfig = {
  appName: 'Wellness Plus',
  logoUrl: '/logos/wellness-plus.svg',
  primaryColor: '#059669',
  secondaryColor: '#14b8a6',

};

const CARPOINT_BRANDING: BrandingConfig = {
  appName: 'CarePoint Medical',
  logoUrl: '/logos/carepoint.svg',
  primaryColor: '#7c3aed',
  secondaryColor: '#a855f7',

};

const MEDICARE_BRANDING: BrandingConfig = {
  appName: 'MediCare Solutions',
  logoUrl: '/logos/medicare.svg',
  primaryColor: '#0284c7',
  secondaryColor: '#38bdf8',

};

const VITALHEALTH_BRANDING: BrandingConfig = {
  appName: 'VitalHealth Center',
  logoUrl: '/logos/vitalhealth.svg',
  primaryColor: '#e11d48',
  secondaryColor: '#fb7185',

};

const FAMILY_PRACTICE_BRANDING: BrandingConfig = {
  appName: 'Family Practice Group',
  logoUrl: '/logos/family-practice.svg',
  primaryColor: '#f97316',
  secondaryColor: '#fb923c',

};

const PREMIER_BRANDING: BrandingConfig = {
  appName: 'Premier Health',
  logoUrl: '/logos/premier.svg',
  primaryColor: '#0891b2',
  secondaryColor: '#06b6d4',

};

export const DEFAULT_BRANDING_FALLBACK: BrandingConfig = {
  appName: 'RemedyGCC',
  logoUrl: '/images/logo.png',
  primaryColor: '#f58220',
  secondaryColor: '#f37820',
  faviconUrl: '/favicon.ico',

};

/** ============================================================================
 * Tenant Data
 * ============================================================================ */
export const tenants: Tenant[] = [
  {
    id: 'tenant-001',
    name: 'HealthFirst Clinic',
    slug: 'healthfirst',
    subdomain: 'healthfirst',
    status: 'active',
    draftScannerId: null,
    draftAttributeTemplateId: null,
    activeRuntimeConfigId: 'runtimecfg_healthfirst_001',
    branding: HEALTHFIRST_BRANDING,
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-03-15T14:30:00Z',
    submissionCount: 182,
    runtimeConfigCount: 1,
  },
  {
    id: 'tenant-002',
    name: 'Wellness Plus',
    slug: 'wellness-plus',
    subdomain: 'wellness-plus',
    status: 'active',
    draftScannerId: null,
    draftAttributeTemplateId: null,
    activeRuntimeConfigId: 'runtimecfg_wellness_001',
    branding: WELLNESS_BRANDING,
    createdAt: '2025-02-20T14:45:00Z',
    updatedAt: '2025-03-28T11:15:00Z',
    submissionCount: 141,
    runtimeConfigCount: 1,
  },
  {
    id: 'tenant-003',
    name: 'CarePoint Medical',
    slug: 'carepoint',
    subdomain: 'carepoint',
    status: 'active',
    draftScannerId: null,
    draftAttributeTemplateId: null,
    activeRuntimeConfigId: 'runtimecfg_carepoint_001',
    branding: CARPOINT_BRANDING,
    createdAt: '2025-03-10T09:15:00Z',
    updatedAt: '2025-03-11T08:00:00Z',
    submissionCount: 88,
    runtimeConfigCount: 1,
  },
  {
    id: 'tenant-004',
    name: 'MediCare Solutions',
    slug: 'medicare',
    subdomain: 'medicare',
    status: 'draft',
    draftScannerId: null,
    draftAttributeTemplateId: null,
    activeRuntimeConfigId: null,
    branding: MEDICARE_BRANDING,
    createdAt: '2025-03-25T16:20:00Z',
    updatedAt: '2025-03-25T16:20:00Z',
    submissionCount: 0,
    runtimeConfigCount: 0,
  },
  {
    id: 'tenant-005',
    name: 'VitalHealth Center',
    slug: 'vitalhealth',
    subdomain: 'vitalhealth',
    status: 'disabled',
    draftScannerId: null,
    draftAttributeTemplateId: null,
    activeRuntimeConfigId: 'runtimecfg_vitalhealth_001',
    branding: VITALHEALTH_BRANDING,
    createdAt: '2024-11-05T11:00:00Z',
    updatedAt: '2025-02-10T16:45:00Z',
    submissionCount: 53,
    runtimeConfigCount: 1,
  },
  {
    id: 'tenant-006',
    name: 'Family Practice Group',
    slug: 'family-practice',
    subdomain: 'family-practice',
    status: 'active',
    draftScannerId: null,
    draftAttributeTemplateId: null,
    activeRuntimeConfigId: 'runtimecfg_family_001',
    branding: FAMILY_PRACTICE_BRANDING,
    createdAt: '2025-04-01T08:30:00Z',
    updatedAt: '2025-04-02T09:30:00Z',
    submissionCount: 64,
    runtimeConfigCount: 1,
  },
  {
    id: 'tenant-007',
    name: 'Premier Health',
    slug: 'premier-health',
    subdomain: 'premier-health',
    status: 'archived',
    draftScannerId: null,
    draftAttributeTemplateId: null,
    activeRuntimeConfigId: 'runtimecfg_premier_001',
    branding: PREMIER_BRANDING,
    createdAt: '2025-04-10T13:45:00Z',
    updatedAt: '2025-04-11T10:00:00Z',
    submissionCount: 29,
    runtimeConfigCount: 1,
  },
];

/** ============================================================================
 * Scanner Data
 * ============================================================================ */
export const scanners: Scanner[] = [
  {
    id: 'scanner-001',
    tenantId: 'tenant-001',
    name: 'Patient Satisfaction Survey',
    description: 'Comprehensive patient satisfaction assessment covering wait times, staff behavior, and overall experience.',
    isActive: true,
    createdAt: '2025-01-16T10:00:00Z',
    updatedAt: '2025-03-15T14:30:00Z',
    questions: [
      {
        id: 'q1',
        text: 'How would you rate your overall experience?',
        type: 'scale',
        required: true,
        weight: 3,
        options: [
          { id: 'q1o1', text: '1 - Very Poor', weight: 1 },
          { id: 'q1o2', text: '2 - Poor', weight: 2 },
          { id: 'q1o3', text: '3 - Average', weight: 3 },
          { id: 'q1o4', text: '4 - Good', weight: 4 },
          { id: 'q1o5', text: '5 - Excellent', weight: 5 },
        ],
      },
      {
        id: 'q2',
        text: 'How long was your wait time?',
        type: 'single',
        required: true,
        weight: 2,
        options: [
          { id: 'q2o1', text: 'Less than 15 minutes', weight: 5 },
          { id: 'q2o2', text: '15-30 minutes', weight: 4 },
          { id: 'q2o3', text: '30-60 minutes', weight: 2 },
          { id: 'q2o4', text: 'More than 60 minutes', weight: 1 },
        ],
      },
      {
        id: 'q3',
        text: 'Which aspects were satisfactory? (Select all that apply)',
        type: 'multiple',
        required: false,
        weight: 2,
        options: [
          { id: 'q3o1', text: 'Staff professionalism', weight: 1 },
          { id: 'q3o2', text: 'Facility cleanliness', weight: 1 },
          { id: 'q3o3', text: 'Communication', weight: 1 },
          { id: 'q3o4', text: 'Treatment effectiveness', weight: 1 },
        ],
      },
    ],
  },
  {
    id: 'scanner-002',
    tenantId: 'tenant-002',
    name: 'Employee Engagement Survey',
    description: 'Internal survey to measure employee satisfaction and workplace culture.',
    isActive: true,
    createdAt: '2025-02-21T09:00:00Z',
    updatedAt: '2025-03-28T11:15:00Z',
    questions: [
      {
        id: 'q1',
        text: 'How satisfied are you with your current role?',
        type: 'scale',
        required: true,
        weight: 3,
        options: [
          { id: 'q1o1', text: '1 - Very Dissatisfied', weight: 1 },
          { id: 'q1o2', text: '2 - Dissatisfied', weight: 2 },
          { id: 'q1o3', text: '3 - Neutral', weight: 3 },
          { id: 'q1o4', text: '4 - Satisfied', weight: 4 },
          { id: 'q1o5', text: '5 - Very Satisfied', weight: 5 },
        ],
      },
      {
        id: 'q2',
        text: 'Would you recommend this workplace to others?',
        type: 'single',
        required: true,
        weight: 2,
        options: [
          { id: 'q2o1', text: 'Definitely Yes', weight: 5 },
          { id: 'q2o2', text: 'Probably Yes', weight: 4 },
          { id: 'q2o3', text: 'Not Sure', weight: 3 },
          { id: 'q2o4', text: 'Probably No', weight: 2 },
          { id: 'q2o5', text: 'Definitely No', weight: 1 },
        ],
      },
    ],
  },
  {
    id: 'scanner-003',
    tenantId: 'tenant-003',
    name: 'Quick Feedback Form',
    description: 'Short feedback form for quick patient responses.',
    isActive: true,
    createdAt: '2025-03-11T08:00:00Z',
    updatedAt: '2025-03-11T08:00:00Z',
    questions: [
      {
        id: 'q1',
        text: 'How likely are you to recommend us?',
        type: 'scale',
        required: true,
        weight: 5,
        options: [
          { id: 'q1o1', text: '0', weight: 0 },
          { id: 'q1o2', text: '1', weight: 1 },
          { id: 'q1o3', text: '2', weight: 2 },
          { id: 'q1o4', text: '3', weight: 3 },
          { id: 'q1o5', text: '4', weight: 4 },
          { id: 'q1o6', text: '5', weight: 5 },
          { id: 'q1o7', text: '6', weight: 6 },
          { id: 'q1o8', text: '7', weight: 7 },
          { id: 'q1o9', text: '8', weight: 8 },
          { id: 'q1o10', text: '9', weight: 9 },
          { id: 'q1o11', text: '10', weight: 10 },
        ],
      },
    ],
  },
  {
    id: 'scanner-005',
    tenantId: 'tenant-005',
    name: 'Comprehensive Health Assessment',
    description: 'Full health assessment scanner with detailed scoring.',
    isActive: false,
    createdAt: '2024-11-06T10:00:00Z',
    updatedAt: '2025-02-10T16:45:00Z',
    questions: [
      {
        id: 'q1',
        text: 'What is your age range?',
        type: 'single',
        required: true,
        weight: 1,
        options: [
          { id: 'q1o1', text: '18-25', weight: 1 },
          { id: 'q1o2', text: '26-35', weight: 2 },
          { id: 'q1o3', text: '36-45', weight: 3 },
          { id: 'q1o4', text: '46-55', weight: 4 },
          { id: 'q1o5', text: '56+', weight: 5 },
        ],
      },
    ],
  },
  {
    id: 'scanner-006',
    tenantId: 'tenant-006',
    name: 'Patient Experience Survey',
    description: 'Detailed patient experience tracking.',
    isActive: true,
    createdAt: '2025-04-02T09:30:00Z',
    updatedAt: '2025-04-02T09:30:00Z',
    questions: [],
  },
  {
    id: 'scanner-007',
    tenantId: 'tenant-007',
    name: 'Basic Feedback',
    description: 'Simple feedback collection.',
    isActive: true,
    createdAt: '2025-04-11T10:00:00Z',
    updatedAt: '2025-04-11T10:00:00Z',
    questions: [],
  },
];

/** ============================================================================
 * System Logs Data
 * ============================================================================ */
export const systemLogs: SystemLog[] = [
  {
    id: 'log-001',
    level: 'info',
    message: 'New tenant created: HealthFirst Clinic',
    module: 'tenant',
    tenantId: 'tenant-001',
    timestamp: '2025-04-15T10:30:00Z',
  },
  {
    id: 'log-002',
    level: 'info',
    message: 'Scanner activated for HealthFirst Clinic',
    module: 'scanner',
    tenantId: 'tenant-001',
    timestamp: '2025-04-15T10:35:00Z',
  },
  {
    id: 'log-003',
    level: 'warning',
    message: 'High submission volume detected from wellness-plus.remedygcc.com',
    module: 'submission',
    tenantId: 'tenant-002',
    timestamp: '2025-04-15T11:20:00Z',
    metadata: { submissionsLastHour: 150 },
  },
  {
    id: 'log-004',
    level: 'error',
    message: 'Failed to process submission: Invalid data format',
    module: 'submission',
    tenantId: 'tenant-003',
    timestamp: '2025-04-15T12:15:00Z',
    metadata: { errorCode: 'INVALID_FORMAT', submissionId: 'sub-xyz' },
  },
  {
    id: 'log-005',
    level: 'info',
    message: 'Tenant branding updated: wellness-plus',
    module: 'tenant',
    tenantId: 'tenant-002',
    timestamp: '2025-04-15T14:00:00Z',
  },
  {
    id: 'log-006',
    level: 'info',
    message: 'Daily backup completed successfully',
    module: 'system',
    timestamp: '2025-04-15T03:00:00Z',
  },
  {
    id: 'log-007',
    level: 'warning',
    message: 'Scanner approaching question limit for carepoint',
    module: 'scanner',
    tenantId: 'tenant-003',
    timestamp: '2025-04-15T15:30:00Z',
    metadata: { currentQuestions: 4, maxQuestions: 5 },
  },
  {
    id: 'log-008',
    level: 'error',
    message: 'Payment failed for tenant: vitalhealth',
    module: 'tenant',
    tenantId: 'tenant-005',
    timestamp: '2025-04-15T16:45:00Z',
    metadata: { amount: 499.99, reason: 'insufficient_funds' },
  },
  {
    id: 'log-009',
    level: 'info',
    message: 'New submission received from family-practice.remedygcc.com',
    module: 'submission',
    tenantId: 'tenant-006',
    timestamp: '2025-04-15T17:00:00Z',
  },
  {
    id: 'log-010',
    level: 'info',
    message: 'System health check: All services operational',
    module: 'system',
    timestamp: '2025-04-15T18:00:00Z',
  },
];

/** ============================================================================
 * Dashboard Statistics
 * ============================================================================ */
export const dashboardStats: DashboardStats = {
  totalTenants: 7,
  activeTenants: 5,
  activeScanners: 4,
  totalLogs: 156,
  totalSubmissions: 5478,
  avgScore: 4.2,
  tenantsByBranding: {
    custom: 7,
    default: 0,
  },
  recentActivity: [
    { date: '2025-04-09', submissions: 145, newTenants: 1 },
    { date: '2025-04-10', submissions: 167, newTenants: 0 },
    { date: '2025-04-11', submissions: 189, newTenants: 2 },
    { date: '2025-04-12', submissions: 134, newTenants: 0 },
    { date: '2025-04-13', submissions: 210, newTenants: 1 },
    { date: '2025-04-14', submissions: 178, newTenants: 0 },
    { date: '2025-04-15', submissions: 195, newTenants: 1 },
  ],
};

/** ============================================================================
 * API Contract Templates (for reference)
 * ============================================================================ */

/*
 * Future API Endpoints to implement:
 * 
 * GET    /api/super-admin/dashboard          -> DashboardStats
 * GET    /api/super-admin/tenants             -> Tenant[] (with branding)
 * GET    /api/super-admin/tenants/:id         -> Tenant
 * POST   /api/super-admin/tenants             -> Tenant (with default branding)
 * PUT    /api/super-admin/tenants/:id         -> Tenant (including branding)
 * PUT    /api/super-admin/tenants/:id/branding -> BrandingConfig
 * DELETE /api/super-admin/tenants/:id         -> void
 * 
 * GET    /api/super-admin/scanners            -> Scanner[]
 * GET    /api/super-admin/scanners/:id        -> Scanner
 * POST   /api/super-admin/scanners             -> Scanner
 * PUT    /api/super-admin/scanners/:id        -> Scanner
 * DELETE /api/super-admin/scanners/:id        -> void
 * 
 * GET    /api/super-admin/logs                -> SystemLog[]
 * GET    /api/super-admin/logs?level=error    -> SystemLog[]
 * GET    /api/super-admin/logs?tenantId=:id   -> SystemLog[]
 */
