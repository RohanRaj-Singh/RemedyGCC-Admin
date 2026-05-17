import * as bcrypt from 'bcryptjs';
import type { TenantStatus } from '@/modules/tenant/types';
import type {
  CreateTenantUserInput,
  TenantAuthContext,
  TenantChangePasswordInput,
  TenantDashboardAccessCreateInput,
  TenantDashboardAccessSummary,
  TenantLoginCredentials,
  TenantLoginResult,
  TenantPasswordResetResult,
  TenantUser,
  TenantUserProfile,
} from '../contracts/types';
import { TENANT_AUTH_CONFIG } from '../contracts/types';
import { createTemporaryPassword, createTenantSessionToken } from '../utils/passwords';
import {
  buildTenantRateLimitKey,
  clearTenantLoginFailures,
  getTenantLoginRateLimitState,
  recordTenantLoginFailure,
} from '../utils/rate-limit';
import {
  normalizeTenantEmail,
  normalizeTenantIdentifier,
  normalizeTenantUsername,
  validateTenantDashboardAccessInput,
  validateTenantLoginInput,
  validateTenantPassword,
} from '../validators/credentials';

export interface TenantLoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface TenantAccessServiceDependencies {
  getNow: () => Date;
  getTenantById: (tenantId: string) => Promise<{ tenantId: string; status: TenantStatus } | null>;
  comparePassword: (value: string, hash: string) => Promise<boolean>;
  hashPassword: (value: string) => Promise<string>;
  createSessionToken: () => string;
  createOneTimePassword: () => string;
  rateLimiter: {
    buildKey: (identifier: string, ipAddress?: string | null) => string;
    getState: (key: string, now: Date) => ReturnType<typeof getTenantLoginRateLimitState>;
    recordFailure: (key: string, now: Date) => ReturnType<typeof recordTenantLoginFailure>;
    clear: (key: string) => void;
  };
  repository: {
    createTenantUser: (input: {
      tenantId: string;
      email: string;
      username: string;
      passwordHash: string;
      mustChangePassword: boolean;
      status: 'active' | 'disabled';
    }) => Promise<TenantUser>;
    getTenantUserById: (userId: string) => Promise<TenantUser | null>;
    getTenantUserByTenantId: (tenantId: string) => Promise<TenantUser | null>;
    getTenantUserByEmail: (email: string) => Promise<TenantUser | null>;
    getTenantUserByUsername: (username: string) => Promise<TenantUser | null>;
    findTenantUserByIdentifier: (identifier: string) => Promise<TenantUser | null>;
    updateTenantUser: (userId: string, updates: Partial<TenantUser>) => Promise<TenantUser | null>;
    createTenantSession: (input: {
      tenantUserId: string;
      tenantId: string;
      sessionToken: string;
      expiresAt: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }) => Promise<import('../contracts/types').TenantSession>;
    getTenantSessionByToken: (sessionToken: string) => Promise<import('../contracts/types').TenantSession | null>;
    updateTenantSessionLastAccessed: (sessionToken: string, lastAccessedAt?: string) => Promise<void>;
    deleteTenantSessionByToken: (sessionToken: string) => Promise<void>;
    deleteTenantSessionsByUserId: (tenantUserId: string) => Promise<void>;
    deleteTenantSessionsByTenantId: (tenantId: string) => Promise<void>;
    deleteExpiredTenantSessions: (nowIso?: string) => Promise<number>;
  };
}

function mapTenantUserToProfile(user: TenantUser): TenantUserProfile {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    username: user.username,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    mustChangePassword: user.mustChangePassword,
  };
}

function getTenantLifecycleFailure(
  status: TenantStatus,
): Pick<TenantLoginResult, 'reason' | 'error'> | null {
  switch (status) {
    case 'draft':
      return {
        reason: 'TENANT_DRAFT',
        error: 'Dashboard access will open once this tenant goes live.',
      };
    case 'disabled':
      return {
        reason: 'TENANT_DISABLED',
        error: 'Dashboard access is temporarily disabled for this tenant.',
      };
    case 'archived':
      return {
        reason: 'TENANT_ARCHIVED',
        error: 'Dashboard access is no longer available for this tenant.',
      };
    case 'active':
    default:
      return null;
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function createDefaultDependencies(): TenantAccessServiceDependencies {
  return {
    getNow: () => new Date(),
    getTenantById: async (tenantId) => {
      const { getTenantDocumentById } = await import('@/server/tenant/repository');
      const tenant = await getTenantDocumentById(tenantId);
      return tenant
        ? {
          tenantId: tenant.tenantId,
          status: tenant.status,
        }
        : null;
    },
    comparePassword: (value, hash) => bcrypt.compare(value, hash),
    hashPassword: (value) => bcrypt.hash(value, 12),
    createSessionToken: createTenantSessionToken,
    createOneTimePassword: createTemporaryPassword,
    rateLimiter: {
      buildKey: buildTenantRateLimitKey,
      getState: getTenantLoginRateLimitState,
      recordFailure: recordTenantLoginFailure,
      clear: clearTenantLoginFailures,
    },
    repository: {
      createTenantUser: async (input) => {
        const repository = await import('../repository/tenant-users');
        return repository.createTenantUser(input);
      },
      getTenantUserById: async (userId) => {
        const repository = await import('../repository/tenant-users');
        return repository.getTenantUserById(userId);
      },
      getTenantUserByTenantId: async (tenantId) => {
        const repository = await import('../repository/tenant-users');
        return repository.getTenantUserByTenantId(tenantId);
      },
      getTenantUserByEmail: async (email) => {
        const repository = await import('../repository/tenant-users');
        return repository.getTenantUserByEmail(email);
      },
      getTenantUserByUsername: async (username) => {
        const repository = await import('../repository/tenant-users');
        return repository.getTenantUserByUsername(username);
      },
      findTenantUserByIdentifier: async (identifier) => {
        const repository = await import('../repository/tenant-users');
        return repository.findTenantUserByIdentifier(identifier);
      },
      updateTenantUser: async (userId, updates) => {
        const repository = await import('../repository/tenant-users');
        return repository.updateTenantUser(userId, updates);
      },
      createTenantSession: async (input) => {
        const repository = await import('../repository/tenant-users');
        return repository.createTenantSession(input);
      },
      getTenantSessionByToken: async (sessionToken) => {
        const repository = await import('../repository/tenant-users');
        return repository.getTenantSessionByToken(sessionToken);
      },
      updateTenantSessionLastAccessed: async (sessionToken, lastAccessedAt) => {
        const repository = await import('../repository/tenant-users');
        return repository.updateTenantSessionLastAccessed(sessionToken, lastAccessedAt);
      },
      deleteTenantSessionByToken: async (sessionToken) => {
        const repository = await import('../repository/tenant-users');
        return repository.deleteTenantSessionByToken(sessionToken);
      },
      deleteTenantSessionsByUserId: async (tenantUserId) => {
        const repository = await import('../repository/tenant-users');
        return repository.deleteTenantSessionsByUserId(tenantUserId);
      },
      deleteTenantSessionsByTenantId: async (tenantId) => {
        const repository = await import('../repository/tenant-users');
        return repository.deleteTenantSessionsByTenantId(tenantId);
      },
      deleteExpiredTenantSessions: async (nowIso) => {
        const repository = await import('../repository/tenant-users');
        return repository.deleteExpiredTenantSessions(nowIso);
      },
    },
  };
}

export function createTenantAuthService(
  dependencies: Partial<TenantAccessServiceDependencies> = {},
) {
  const base = createDefaultDependencies();
  const deps: TenantAccessServiceDependencies = {
    ...base,
    ...dependencies,
    rateLimiter: {
      ...base.rateLimiter,
      ...(dependencies.rateLimiter ?? {}),
    },
    repository: {
      ...base.repository,
      ...(dependencies.repository ?? {}),
    },
  };

  async function createTenantDashboardAccess(
    input: TenantDashboardAccessCreateInput & { tenantId: string },
  ): Promise<TenantDashboardAccessSummary> {
    const validation = validateTenantDashboardAccessInput(input);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }

    const tenant = await deps.getTenantById(input.tenantId);
    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    const existingForTenant = await deps.repository.getTenantUserByTenantId(input.tenantId);
    if (existingForTenant) {
      throw new Error('Tenant dashboard credentials already exist for this tenant.');
    }

    const email = normalizeTenantEmail(input.email);
    const username = normalizeTenantUsername(input.username);

    const [existingEmail, existingUsername] = await Promise.all([
      deps.repository.getTenantUserByEmail(email),
      deps.repository.getTenantUserByUsername(username),
    ]);

    if (existingEmail) {
      throw new Error('That dashboard email is already in use.');
    }

    if (existingUsername) {
      throw new Error('That dashboard username is already in use.');
    }

    const passwordHash = await deps.hashPassword(input.password.trim());
    const user = await deps.repository.createTenantUser({
      tenantId: input.tenantId,
      email,
      username,
      passwordHash,
      mustChangePassword: false,
      status: 'active',
    });

    return {
      tenantId: input.tenantId,
      tenantStatus: tenant.status,
      dashboardAccessAllowed: tenant.status === 'active' && user.status === 'active',
      hasCredentials: true,
      user: mapTenantUserToProfile(user),
    };
  }

  async function getTenantDashboardAccess(
    tenantId: string,
  ): Promise<TenantDashboardAccessSummary> {
    const tenant = await deps.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    const user = await deps.repository.getTenantUserByTenantId(tenantId);
    return {
      tenantId,
      tenantStatus: tenant.status,
      dashboardAccessAllowed: tenant.status === 'active' && user?.status === 'active',
      hasCredentials: Boolean(user),
      user: user ? mapTenantUserToProfile(user) : null,
    };
  }

  async function disableTenantDashboardAccess(tenantId: string): Promise<TenantDashboardAccessSummary> {
    const user = await deps.repository.getTenantUserByTenantId(tenantId);
    if (!user) {
      throw new Error('Tenant dashboard credentials have not been created yet.');
    }

    await deps.repository.updateTenantUser(user.id, {
      status: 'disabled',
    });
    await deps.repository.deleteTenantSessionsByUserId(user.id);

    return getTenantDashboardAccess(tenantId);
  }

  async function reactivateTenantDashboardAccess(tenantId: string): Promise<TenantDashboardAccessSummary> {
    const user = await deps.repository.getTenantUserByTenantId(tenantId);
    if (!user) {
      throw new Error('Tenant dashboard credentials have not been created yet.');
    }

    await deps.repository.updateTenantUser(user.id, {
      status: 'active',
    });

    return getTenantDashboardAccess(tenantId);
  }

  async function resetTenantDashboardPassword(
    tenantId: string,
  ): Promise<TenantPasswordResetResult> {
    const user = await deps.repository.getTenantUserByTenantId(tenantId);
    if (!user) {
      throw new Error('Tenant dashboard credentials have not been created yet.');
    }

    const temporaryPassword = deps.createOneTimePassword();
    const passwordHash = await deps.hashPassword(temporaryPassword);
    const updatedUser = await deps.repository.updateTenantUser(user.id, {
      passwordHash,
      mustChangePassword: true,
    });

    await deps.repository.deleteTenantSessionsByUserId(user.id);

    if (!updatedUser) {
      throw new Error('Password reset could not be completed.');
    }

    return {
      user: mapTenantUserToProfile(updatedUser),
      temporaryPassword,
      mustChangePassword: true,
    };
  }

  async function invalidateTenantSession(sessionToken: string): Promise<void> {
    if (!sessionToken) {
      return;
    }

    await deps.repository.deleteTenantSessionByToken(sessionToken);
  }

  async function loginTenantUser(
    credentials: TenantLoginCredentials,
    context: TenantLoginContext = {},
  ): Promise<TenantLoginResult> {
    const validation = validateTenantLoginInput(credentials);
    if (!validation.isValid) {
      return {
        success: false,
        reason: 'INVALID_CREDENTIALS',
        error: validation.errors[0],
      };
    }

    const now = deps.getNow();
    const rateLimitKey = deps.rateLimiter.buildKey(
      credentials.identifier,
      context.ipAddress,
    );
    const rateLimitState = deps.rateLimiter.getState(rateLimitKey, now);

    if (!rateLimitState.allowed) {
      return {
        success: false,
        reason: 'RATE_LIMITED',
        error: 'Too many login attempts. Please try again later.',
        retryAfterSeconds: rateLimitState.retryAfterSeconds,
      };
    }

    const user = await deps.repository.findTenantUserByIdentifier(
      normalizeTenantIdentifier(credentials.identifier),
    );

    if (!user) {
      deps.rateLimiter.recordFailure(rateLimitKey, now);
      return {
        success: false,
        reason: 'INVALID_CREDENTIALS',
        error: 'Invalid email/username or password.',
      };
    }

    if (user.status === 'disabled') {
      return {
        success: false,
        reason: 'USER_DISABLED',
        error: 'Dashboard access for this account is disabled.',
      };
    }

    const tenant = await deps.getTenantById(user.tenantId);
    if (!tenant) {
      return {
        success: false,
        reason: 'INVALID_CREDENTIALS',
        error: 'Tenant dashboard access is unavailable.',
      };
    }

    const lifecycleFailure = getTenantLifecycleFailure(tenant.status);
    if (lifecycleFailure) {
      return {
        success: false,
        ...lifecycleFailure,
      };
    }

    const isValidPassword = await deps.comparePassword(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      deps.rateLimiter.recordFailure(rateLimitKey, now);
      return {
        success: false,
        reason: 'INVALID_CREDENTIALS',
        error: 'Invalid email/username or password.',
      };
    }

    deps.rateLimiter.clear(rateLimitKey);
    await deps.repository.deleteExpiredTenantSessions(now.toISOString());
    await deps.repository.deleteTenantSessionsByUserId(user.id);

    const sessionToken = deps.createSessionToken();
    const expiresAt = addDays(now, TENANT_AUTH_CONFIG.sessionExpiryDays).toISOString();
    const session = await deps.repository.createTenantSession({
      tenantUserId: user.id,
      tenantId: user.tenantId,
      sessionToken,
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    const updatedUser = await deps.repository.updateTenantUser(user.id, {
      lastLoginAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return {
      success: true,
      user: mapTenantUserToProfile(updatedUser ?? {
        ...user,
        lastLoginAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
      session,
      requiresPasswordChange: user.mustChangePassword,
    };
  }

  async function validateTenantSession(
    sessionToken: string,
  ): Promise<TenantAuthContext | null> {
    if (!sessionToken) {
      return null;
    }

    const session = await deps.repository.getTenantSessionByToken(sessionToken);
    if (!session) {
      return null;
    }

    const now = deps.getNow();
    if (new Date(session.expiresAt) <= now) {
      await deps.repository.deleteTenantSessionByToken(session.sessionToken);
      return null;
    }

    const user = await deps.repository.getTenantUserById(session.tenantUserId);
    if (!user || user.tenantId !== session.tenantId || user.status !== 'active') {
      await deps.repository.deleteTenantSessionByToken(session.sessionToken);
      return null;
    }

    const tenant = await deps.getTenantById(user.tenantId);
    if (!tenant || tenant.status !== 'active') {
      await deps.repository.deleteTenantSessionByToken(session.sessionToken);
      return null;
    }

    await deps.repository.updateTenantSessionLastAccessed(session.sessionToken, now.toISOString());

    return {
      user: mapTenantUserToProfile(user),
      session: {
        ...session,
        lastAccessedAt: now.toISOString(),
      },
      tenantStatus: tenant.status,
    };
  }

  async function changeTenantPassword(
    userId: string,
    input: TenantChangePasswordInput,
  ): Promise<TenantUserProfile> {
    const validation = validateTenantPassword(input.newPassword);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }

    const user = await deps.repository.getTenantUserById(userId);
    if (!user) {
      throw new Error('Tenant user not found.');
    }

    const isValidPassword = await deps.comparePassword(
      input.currentPassword,
      user.passwordHash,
    );

    if (!isValidPassword) {
      throw new Error('Current password is incorrect.');
    }

    const passwordHash = await deps.hashPassword(input.newPassword.trim());
    const updatedUser = await deps.repository.updateTenantUser(userId, {
      passwordHash,
      mustChangePassword: false,
    });

    if (!updatedUser) {
      throw new Error('Password change could not be completed.');
    }

    return mapTenantUserToProfile(updatedUser);
  }

  async function deleteTenantAccessForTenant(tenantId: string): Promise<void> {
    const user = await deps.repository.getTenantUserByTenantId(tenantId);
    if (!user) {
      return;
    }

    await deps.repository.deleteTenantSessionsByTenantId(tenantId);
  }

  async function bootstrapTenantUser(
    input: CreateTenantUserInput,
  ): Promise<TenantUserProfile> {
    const summary = await createTenantDashboardAccess({
      tenantId: input.tenantId,
      email: input.email,
      username: input.username,
      password: input.password,
    });

    if (!summary.user) {
      throw new Error('Tenant dashboard credentials could not be created.');
    }

    if (input.mustChangePassword) {
      const user = await deps.repository.getTenantUserByTenantId(input.tenantId);
      if (user) {
        await deps.repository.updateTenantUser(user.id, {
          mustChangePassword: true,
        });
        return {
          ...summary.user,
          mustChangePassword: true,
        };
      }
    }

    return summary.user;
  }

  return {
    bootstrapTenantUser,
    changeTenantPassword,
    createTenantDashboardAccess,
    deleteTenantAccessForTenant,
    disableTenantDashboardAccess,
    getTenantDashboardAccess,
    invalidateTenantSession,
    loginTenantUser,
    reactivateTenantDashboardAccess,
    resetTenantDashboardPassword,
    validateTenantSession,
  };
}

const tenantAuthService = createTenantAuthService();

export const bootstrapTenantUser = tenantAuthService.bootstrapTenantUser;
export const changeTenantPassword = tenantAuthService.changeTenantPassword;
export const createTenantDashboardAccess = tenantAuthService.createTenantDashboardAccess;
export const deleteTenantAccessForTenant = tenantAuthService.deleteTenantAccessForTenant;
export const disableTenantDashboardAccess = tenantAuthService.disableTenantDashboardAccess;
export const getTenantDashboardAccess = tenantAuthService.getTenantDashboardAccess;
export const invalidateTenantSession = tenantAuthService.invalidateTenantSession;
export const loginTenantUser = tenantAuthService.loginTenantUser;
export const reactivateTenantDashboardAccess = tenantAuthService.reactivateTenantDashboardAccess;
export const resetTenantDashboardPassword = tenantAuthService.resetTenantDashboardPassword;
export const validateTenantSession = tenantAuthService.validateTenantSession;
export { mapTenantUserToProfile };
