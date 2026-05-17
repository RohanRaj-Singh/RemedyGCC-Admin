import 'server-only';

import { randomUUID } from 'node:crypto';
import { runMongoScript } from '@/server/mongo-shell';
import type {
  CreateTenantSessionInput,
  CreateTenantUserRecordInput,
  TenantSession,
  TenantUser,
  UpdateTenantUserInput,
} from '../contracts/types';
import {
  normalizeTenantEmail,
  normalizeTenantIdentifier,
  normalizeTenantUsername,
} from '../validators/credentials';

const TENANT_USERS_COLLECTION = 'tenantDashboardUsers';
const TENANT_SESSIONS_COLLECTION = 'tenantDashboardSessions';

let indexPromise: Promise<void> | null = null;

function createTenantUserId(): string {
  return `tenant-user-${randomUUID()}`;
}

function createTenantSessionId(): string {
  return `tenant-session-${randomUUID()}`;
}

export async function ensureTenantAuthIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = runMongoScript<void>(`
const __ensureIndex = (collectionName, key, options = {}) => {
  const collection = db.getCollection(collectionName);
  let existing;

  try {
    existing = collection
      .getIndexes()
      .find((index) => JSON.stringify(index.key) === JSON.stringify(key));
  } catch (error) {
    existing = null;
  }

  if (existing) {
    return existing.name;
  }

  return collection.createIndex(key, options);
};

__ensureIndex('${TENANT_USERS_COLLECTION}', { tenantId: 1 }, { unique: true, name: 'tenant_dashboard_user_tenant_unique' });
__ensureIndex('${TENANT_USERS_COLLECTION}', { email: 1 }, { unique: true, name: 'tenant_dashboard_user_email_unique' });
__ensureIndex('${TENANT_USERS_COLLECTION}', { username: 1 }, { unique: true, name: 'tenant_dashboard_user_username_unique' });

__ensureIndex('${TENANT_SESSIONS_COLLECTION}', { sessionToken: 1 }, { unique: true, name: 'tenant_dashboard_session_token_unique' });
__ensureIndex('${TENANT_SESSIONS_COLLECTION}', { tenantUserId: 1 }, { name: 'tenant_dashboard_session_user_id' });
__ensureIndex('${TENANT_SESSIONS_COLLECTION}', { tenantId: 1 }, { name: 'tenant_dashboard_session_tenant_id' });
__ensureIndex('${TENANT_SESSIONS_COLLECTION}', { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'tenant_dashboard_session_ttl' });

__emit(null);
`).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

export async function createTenantUser(
  input: CreateTenantUserRecordInput,
): Promise<TenantUser> {
  await ensureTenantAuthIndexes();

  const now = new Date().toISOString();
  const user: TenantUser = {
    id: createTenantUserId(),
    tenantId: input.tenantId,
    email: normalizeTenantEmail(input.email),
    username: normalizeTenantUsername(input.username),
    passwordHash: input.passwordHash,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    mustChangePassword: input.mustChangePassword,
  };

  return runMongoScript<TenantUser>(`
db.getCollection('${TENANT_USERS_COLLECTION}').insertOne(__payload.user);
__emit(__strip(__payload.user));
`, { user });
}

export async function getTenantUserById(
  userId: string,
): Promise<TenantUser | null> {
  await ensureTenantAuthIndexes();

  return runMongoScript<TenantUser | null>(`
const user = db.getCollection('${TENANT_USERS_COLLECTION}').findOne(
  { id: __payload.userId },
  { projection: { _id: 0 } },
);
__emit(__strip(user));
`, { userId });
}

export async function getTenantUserByTenantId(
  tenantId: string,
): Promise<TenantUser | null> {
  await ensureTenantAuthIndexes();

  return runMongoScript<TenantUser | null>(`
const user = db.getCollection('${TENANT_USERS_COLLECTION}').findOne(
  { tenantId: __payload.tenantId },
  { projection: { _id: 0 } },
);
__emit(__strip(user));
`, { tenantId });
}

export async function getTenantUserByEmail(
  email: string,
): Promise<TenantUser | null> {
  await ensureTenantAuthIndexes();

  return runMongoScript<TenantUser | null>(`
const user = db.getCollection('${TENANT_USERS_COLLECTION}').findOne(
  { email: __payload.email },
  { projection: { _id: 0 } },
);
__emit(__strip(user));
`, { email: normalizeTenantEmail(email) });
}

export async function getTenantUserByUsername(
  username: string,
): Promise<TenantUser | null> {
  await ensureTenantAuthIndexes();

  return runMongoScript<TenantUser | null>(`
const user = db.getCollection('${TENANT_USERS_COLLECTION}').findOne(
  { username: __payload.username },
  { projection: { _id: 0 } },
);
__emit(__strip(user));
`, { username: normalizeTenantUsername(username) });
}

export async function findTenantUserByIdentifier(
  identifier: string,
): Promise<TenantUser | null> {
  await ensureTenantAuthIndexes();

  const normalizedIdentifier = normalizeTenantIdentifier(identifier);
  return runMongoScript<TenantUser | null>(`
const user = db.getCollection('${TENANT_USERS_COLLECTION}').findOne(
  {
    $or: [
      { email: __payload.identifier },
      { username: __payload.identifier },
    ],
  },
  { projection: { _id: 0 } },
);
__emit(__strip(user));
`, { identifier: normalizedIdentifier });
}

export async function updateTenantUser(
  userId: string,
  updates: UpdateTenantUserInput,
): Promise<TenantUser | null> {
  await ensureTenantAuthIndexes();

  const normalizedUpdates = {
    ...updates,
    email: updates.email !== undefined ? normalizeTenantEmail(updates.email) : undefined,
    username: updates.username !== undefined ? normalizeTenantUsername(updates.username) : undefined,
    updatedAt: updates.updatedAt ?? new Date().toISOString(),
  };

  return runMongoScript<TenantUser | null>(`
const updates = Object.fromEntries(
  Object.entries(__payload.updates).filter(([, value]) => value !== undefined),
);

const updatedUser = db.getCollection('${TENANT_USERS_COLLECTION}').findOneAndUpdate(
  { id: __payload.userId },
  { $set: updates },
  {
    returnDocument: 'after',
    projection: { _id: 0 },
  },
);

__emit(__strip(updatedUser));
`, {
    userId,
    updates: normalizedUpdates,
  });
}

export async function createTenantSession(
  input: CreateTenantSessionInput,
): Promise<TenantSession> {
  await ensureTenantAuthIndexes();

  const now = new Date().toISOString();
  const session: TenantSession = {
    id: createTenantSessionId(),
    tenantUserId: input.tenantUserId,
    tenantId: input.tenantId,
    sessionToken: input.sessionToken,
    createdAt: now,
    expiresAt: input.expiresAt,
    lastAccessedAt: now,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };

  return runMongoScript<TenantSession>(`
db.getCollection('${TENANT_SESSIONS_COLLECTION}').insertOne(__payload.session);
__emit(__strip(__payload.session));
`, { session });
}

export async function getTenantSessionByToken(
  sessionToken: string,
): Promise<TenantSession | null> {
  await ensureTenantAuthIndexes();

  return runMongoScript<TenantSession | null>(`
const session = db.getCollection('${TENANT_SESSIONS_COLLECTION}').findOne(
  { sessionToken: __payload.sessionToken },
  { projection: { _id: 0 } },
);
__emit(__strip(session));
`, { sessionToken });
}

export async function updateTenantSessionLastAccessed(
  sessionToken: string,
  lastAccessedAt: string = new Date().toISOString(),
): Promise<void> {
  await ensureTenantAuthIndexes();

  await runMongoScript(`
db.getCollection('${TENANT_SESSIONS_COLLECTION}').updateOne(
  { sessionToken: __payload.sessionToken },
  { $set: { lastAccessedAt: __payload.lastAccessedAt } },
);
__emit(true);
`, {
    sessionToken,
    lastAccessedAt,
  });
}

export async function deleteTenantSessionByToken(
  sessionToken: string,
): Promise<void> {
  await ensureTenantAuthIndexes();

  await runMongoScript(`
db.getCollection('${TENANT_SESSIONS_COLLECTION}').deleteOne({
  sessionToken: __payload.sessionToken,
});
__emit(true);
`, { sessionToken });
}

export async function deleteTenantSessionsByUserId(
  tenantUserId: string,
): Promise<void> {
  await ensureTenantAuthIndexes();

  await runMongoScript(`
db.getCollection('${TENANT_SESSIONS_COLLECTION}').deleteMany({
  tenantUserId: __payload.tenantUserId,
});
__emit(true);
`, { tenantUserId });
}

export async function deleteTenantSessionsByTenantId(
  tenantId: string,
): Promise<void> {
  await ensureTenantAuthIndexes();

  await runMongoScript(`
db.getCollection('${TENANT_SESSIONS_COLLECTION}').deleteMany({
  tenantId: __payload.tenantId,
});
__emit(true);
`, { tenantId });
}

export async function deleteExpiredTenantSessions(
  nowIso: string = new Date().toISOString(),
): Promise<number> {
  await ensureTenantAuthIndexes();

  return runMongoScript<number>(`
const result = db.getCollection('${TENANT_SESSIONS_COLLECTION}').deleteMany({
  expiresAt: { $lt: __payload.nowIso },
});
__emit(result.deletedCount);
`, { nowIso });
}
