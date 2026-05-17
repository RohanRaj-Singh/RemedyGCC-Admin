import type { TenantStatus } from '@/modules/tenant/types';

export type TenantUserStatus = 'active' | 'disabled';

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  username: string;
  passwordHash: string;
  status: TenantUserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export interface TenantUserProfile {
  id: string;
  tenantId: string;
  email: string;
  username: string;
  status: TenantUserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export interface TenantSession {
  id: string;
  tenantUserId: string;
  tenantId: string;
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateTenantUserInput {
  tenantId: string;
  email: string;
  username: string;
  password: string;
  mustChangePassword?: boolean;
  status?: TenantUserStatus;
}

export interface CreateTenantUserRecordInput {
  tenantId: string;
  email: string;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
  status: TenantUserStatus;
}

export interface UpdateTenantUserInput {
  email?: string;
  username?: string;
  passwordHash?: string;
  status?: TenantUserStatus;
  lastLoginAt?: string | null;
  mustChangePassword?: boolean;
  updatedAt?: string;
}

export interface CreateTenantSessionInput {
  tenantUserId: string;
  tenantId: string;
  sessionToken: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface TenantLoginCredentials {
  identifier: string;
  password: string;
}

export type TenantLoginFailureReason =
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'USER_DISABLED'
  | 'TENANT_DRAFT'
  | 'TENANT_DISABLED'
  | 'TENANT_ARCHIVED';

export interface TenantLoginResult {
  success: boolean;
  user?: TenantUserProfile;
  session?: TenantSession;
  requiresPasswordChange?: boolean;
  error?: string;
  reason?: TenantLoginFailureReason;
  retryAfterSeconds?: number;
}

export interface TenantAuthContext {
  user: TenantUserProfile;
  session: TenantSession;
  tenantStatus: TenantStatus;
}

export interface TenantDashboardAccessCreateInput {
  email: string;
  username: string;
  password: string;
}

export interface TenantDashboardAccessSummary {
  tenantId: string;
  tenantStatus: TenantStatus;
  dashboardAccessAllowed: boolean;
  hasCredentials: boolean;
  user: TenantUserProfile | null;
}

export interface TenantPasswordResetResult {
  user: TenantUserProfile;
  temporaryPassword: string;
  mustChangePassword: true;
}

export interface TenantChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface TenantRateLimitState {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

export interface TenantAuthConfig {
  sessionExpiryDays: number;
  maxLoginAttempts: number;
  lockoutMinutes: number;
  sessionCookieName: string;
  passwordChangeCookieName: string;
  sessionTokenBytes: number;
  temporaryPasswordLength: number;
}

export const TENANT_AUTH_CONFIG: TenantAuthConfig = {
  sessionExpiryDays: 7,
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  sessionCookieName: 'tenant_dashboard_session',
  passwordChangeCookieName: 'tenant_dashboard_password_change',
  sessionTokenBytes: 32,
  temporaryPasswordLength: 16,
};
