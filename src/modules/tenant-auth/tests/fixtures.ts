import * as bcrypt from 'bcryptjs';
import type { TenantStatus } from '@/modules/tenant/types';
import type { TenantSession, TenantUser } from '../contracts/types';
import { createTenantAuthService } from '../services/auth-service';
import {
  buildTenantRateLimitKey,
  clearTenantLoginFailures,
  getTenantLoginRateLimitState,
  recordTenantLoginFailure,
  resetTenantLoginRateLimiter,
} from '../utils/rate-limit';

interface TenantLookupRecord {
  tenantId: string;
  status: TenantStatus;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createIsoDate(value: string): string {
  return new Date(value).toISOString();
}

export async function createTenantAuthTestContext() {
  resetTenantLoginRateLimiter();

  const now = new Date('2026-05-17T12:00:00.000Z');
  const nowIso = now.toISOString();
  let sessionCounter = 0;
  let tempPasswordCounter = 0;

  const tenants = new Map<string, TenantLookupRecord>([
    ['tenant-active', { tenantId: 'tenant-active', status: 'active' }],
    ['tenant-disabled', { tenantId: 'tenant-disabled', status: 'disabled' }],
    ['tenant-archived', { tenantId: 'tenant-archived', status: 'archived' }],
    ['tenant-draft', { tenantId: 'tenant-draft', status: 'draft' }],
    ['tenant-provisioning', { tenantId: 'tenant-provisioning', status: 'active' }],
  ]);

  const users = new Map<string, TenantUser>([
    [
      'tenant-user-active',
      {
        id: 'tenant-user-active',
        tenantId: 'tenant-active',
        email: 'owner@active.test',
        username: 'active.owner',
        passwordHash: await bcrypt.hash('OwnerPass123!', 12),
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null,
        mustChangePassword: false,
      },
    ],
    [
      'tenant-user-disabled',
      {
        id: 'tenant-user-disabled',
        tenantId: 'tenant-disabled',
        email: 'owner@disabled.test',
        username: 'disabled.owner',
        passwordHash: await bcrypt.hash('OwnerPass123!', 12),
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null,
        mustChangePassword: false,
      },
    ],
    [
      'tenant-user-archived',
      {
        id: 'tenant-user-archived',
        tenantId: 'tenant-archived',
        email: 'owner@archived.test',
        username: 'archived.owner',
        passwordHash: await bcrypt.hash('OwnerPass123!', 12),
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null,
        mustChangePassword: false,
      },
    ],
    [
      'tenant-user-draft',
      {
        id: 'tenant-user-draft',
        tenantId: 'tenant-draft',
        email: 'owner@draft.test',
        username: 'draft.owner',
        passwordHash: await bcrypt.hash('OwnerPass123!', 12),
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null,
        mustChangePassword: false,
      },
    ],
  ]);

  const sessions = new Map<string, TenantSession>([
    [
      'tds_expired_session_token_0000000000000000000000000000000000000000000000',
      {
        id: 'tenant-session-expired',
        tenantUserId: 'tenant-user-active',
        tenantId: 'tenant-active',
        sessionToken: 'tds_expired_session_token_0000000000000000000000000000000000000000000000',
        createdAt: createIsoDate('2026-05-01T10:00:00.000Z'),
        expiresAt: createIsoDate('2026-05-10T10:00:00.000Z'),
        lastAccessedAt: createIsoDate('2026-05-09T10:00:00.000Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'fixture-agent',
      },
    ],
  ]);

  const repository = {
    async createTenantUser(input: {
      tenantId: string;
      email: string;
      username: string;
      passwordHash: string;
      mustChangePassword: boolean;
      status: 'active' | 'disabled';
    }) {
      const user: TenantUser = {
        id: `tenant-user-${users.size + 1}`,
        tenantId: input.tenantId,
        email: input.email.toLowerCase(),
        username: input.username.toLowerCase(),
        passwordHash: input.passwordHash,
        status: input.status,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null,
        mustChangePassword: input.mustChangePassword,
      };

      users.set(user.id, clone(user));
      return clone(user);
    },
    async getTenantUserById(userId: string) {
      return clone(users.get(userId) ?? null);
    },
    async getTenantUserByTenantId(tenantId: string) {
      const user = [...users.values()].find((entry) => entry.tenantId === tenantId) ?? null;
      return clone(user);
    },
    async getTenantUserByEmail(email: string) {
      const user = [...users.values()].find((entry) => entry.email === email.toLowerCase()) ?? null;
      return clone(user);
    },
    async getTenantUserByUsername(username: string) {
      const user = [...users.values()].find((entry) => entry.username === username.toLowerCase()) ?? null;
      return clone(user);
    },
    async findTenantUserByIdentifier(identifier: string) {
      const normalized = identifier.toLowerCase();
      const user = [...users.values()].find(
        (entry) => entry.email === normalized || entry.username === normalized,
      ) ?? null;
      return clone(user);
    },
    async updateTenantUser(userId: string, updates: Partial<TenantUser>) {
      const current = users.get(userId);
      if (!current) {
        return null;
      }

      const next = {
        ...current,
        ...clone(updates),
        updatedAt: updates.updatedAt ?? nowIso,
      };
      users.set(userId, next);
      return clone(next);
    },
    async createTenantSession(input: {
      tenantUserId: string;
      tenantId: string;
      sessionToken: string;
      expiresAt: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }) {
      const session: TenantSession = {
        id: `tenant-session-${++sessionCounter}`,
        tenantUserId: input.tenantUserId,
        tenantId: input.tenantId,
        sessionToken: input.sessionToken,
        createdAt: nowIso,
        expiresAt: input.expiresAt,
        lastAccessedAt: nowIso,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      };

      sessions.set(session.sessionToken, clone(session));
      return clone(session);
    },
    async getTenantSessionByToken(sessionToken: string) {
      return clone(sessions.get(sessionToken) ?? null);
    },
    async updateTenantSessionLastAccessed(sessionToken: string, lastAccessedAt: string = nowIso) {
      const current = sessions.get(sessionToken);
      if (!current) {
        return;
      }

      sessions.set(sessionToken, {
        ...current,
        lastAccessedAt,
      });
    },
    async deleteTenantSessionByToken(sessionToken: string) {
      sessions.delete(sessionToken);
    },
    async deleteTenantSessionsByUserId(tenantUserId: string) {
      for (const [token, session] of sessions.entries()) {
        if (session.tenantUserId === tenantUserId) {
          sessions.delete(token);
        }
      }
    },
    async deleteTenantSessionsByTenantId(tenantId: string) {
      for (const [token, session] of sessions.entries()) {
        if (session.tenantId === tenantId) {
          sessions.delete(token);
        }
      }
    },
    async deleteExpiredTenantSessions(nowDateIso: string = nowIso) {
      let deleted = 0;
      for (const [token, session] of sessions.entries()) {
        if (session.expiresAt < nowDateIso) {
          sessions.delete(token);
          deleted += 1;
        }
      }

      return deleted;
    },
  };

  const service = createTenantAuthService({
    getNow: () => new Date(now),
    getTenantById: async (tenantId) => clone(tenants.get(tenantId) ?? null),
    comparePassword: (value, hash) => bcrypt.compare(value, hash),
    hashPassword: (value) => bcrypt.hash(value, 12),
    createSessionToken: () => `tds_${String(++sessionCounter).padStart(64, '0')}`,
    createOneTimePassword: () => `TempPass${String(++tempPasswordCounter).padStart(4, '0')}!A`,
    rateLimiter: {
      buildKey: buildTenantRateLimitKey,
      getState: getTenantLoginRateLimitState,
      recordFailure: recordTenantLoginFailure,
      clear: clearTenantLoginFailures,
    },
    repository,
  });

  return {
    now,
    nowIso,
    repository,
    service,
    sessions,
    tenants,
    users,
  };
}
