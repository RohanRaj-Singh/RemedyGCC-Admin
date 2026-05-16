import 'server-only';

import { runMongoScript } from '../mongo-shell';

export interface AdminDocument {
  id: string;
  email: string;
  passwordHash: string;
  role: 'super_admin' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AdminSessionDocument {
  id: string;
  sessionToken: string;
  adminId: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

let indexPromise: Promise<void> | null = null;

export async function ensureAuthIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = runMongoScript<void>(`
const __ensureIndex = (collectionName, key, options = {}) => {
  const collection = db.getCollection(collectionName);
  let existing;
  try {
    existing = collection
      .getIndexes()
      .find((index) => {
        return JSON.stringify(index.key) === JSON.stringify(key);
      });
  } catch (e) {
    existing = null;
  }

  if (existing) {
    return existing.name;
  }

  return collection.createIndex(key, options);
};

__ensureIndex('admins', { email: 1 }, { unique: true, name: 'admin_email_unique' });
__ensureIndex('adminSessions', { sessionToken: 1 }, { unique: true, name: 'admin_session_token_unique' });
__ensureIndex('adminSessions', { adminId: 1 }, { name: 'admin_sessions_admin_id' });
__ensureIndex('adminSessions', { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'admin_sessions_ttl' });

__emit(null);
`).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

// Admin operations
export async function createAdmin(
  email: string,
  passwordHash: string,
  role: 'super_admin' | 'admin' = 'admin'
): Promise<AdminDocument> {
  await ensureAuthIndexes();
  const now = new Date().toISOString();
  const id = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  return runMongoScript<AdminDocument>(`
const newAdmin = {
  id: __payload.id,
  email: __payload.email,
  passwordHash: __payload.passwordHash,
  role: __payload.role,
  status: 'active',
  createdAt: __payload.createdAt,
  updatedAt: __payload.updatedAt,
  lastLoginAt: null
};
db.admins.insertOne(newAdmin);
__emit(__strip(newAdmin));
`, { id, email, passwordHash, role, createdAt: now, updatedAt: now });
}

export async function getAdminByEmail(email: string): Promise<AdminDocument | null> {
  await ensureAuthIndexes();
  return runMongoScript<AdminDocument | null>(`
const admin = db.admins.findOne({ email: __payload.email }, { projection: { _id: 0 } });
__emit(__strip(admin));
`, { email });
}

export async function getAdminById(id: string): Promise<AdminDocument | null> {
  await ensureAuthIndexes();
  return runMongoScript<AdminDocument | null>(`
const admin = db.admins.findOne({ id: __payload.id }, { projection: { _id: 0 } });
__emit(__strip(admin));
`, { id });
}

export async function updateAdminLastLogin(adminId: string): Promise<void> {
  await ensureAuthIndexes();
  await runMongoScript(`
db.admins.updateOne(
  { id: __payload.adminId },
  { $set: { lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }
);
__emit(true);
`, { adminId });
}

export async function updateAdminPassword(adminId: string, newPasswordHash: string): Promise<void> {
  await ensureAuthIndexes();
  await runMongoScript(`
db.admins.updateOne(
  { id: __payload.adminId },
  { $set: { passwordHash: __payload.passwordHash, updatedAt: new Date().toISOString() } }
);
__emit(true);
`, { adminId, passwordHash: newPasswordHash });
}

// Session operations
export async function createSession(
  adminId: string,
  sessionToken: string,
  expiresAt: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AdminSessionDocument> {
  await ensureAuthIndexes();
  const now = new Date().toISOString();
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  return runMongoScript<AdminSessionDocument>(`
const newSession = {
  id: __payload.id,
  sessionToken: __payload.sessionToken,
  adminId: __payload.adminId,
  createdAt: __payload.createdAt,
  expiresAt: __payload.expiresAt,
  lastAccessedAt: __payload.createdAt,
  ipAddress: __payload.ipAddress,
  userAgent: __payload.userAgent
};
db.adminSessions.insertOne(newSession);
__emit(__strip(newSession));
`, { id, sessionToken, adminId, createdAt: now, expiresAt, ipAddress, userAgent });
}

export async function getSessionByToken(sessionToken: string): Promise<AdminSessionDocument | null> {
  await ensureAuthIndexes();
  return runMongoScript<AdminSessionDocument | null>(`
const session = db.adminSessions.findOne(
  { sessionToken: __payload.sessionToken },
  { projection: { _id: 0 } }
);
__emit(__strip(session));
`, { sessionToken });
}

export async function updateSessionAccess(sessionToken: string): Promise<void> {
  await ensureAuthIndexes();
  await runMongoScript(`
db.adminSessions.updateOne(
  { sessionToken: __payload.sessionToken },
  { $set: { lastAccessedAt: new Date().toISOString() } }
);
__emit(true);
`, { sessionToken });
}

export async function deleteSession(sessionToken: string): Promise<void> {
  await ensureAuthIndexes();
  await runMongoScript(`
db.adminSessions.deleteOne({ sessionToken: __payload.sessionToken });
__emit(true);
`, { sessionToken });
}

export async function deleteAllAdminSessions(adminId: string): Promise<void> {
  await ensureAuthIndexes();
  await runMongoScript(`
db.adminSessions.deleteMany({ adminId: __payload.adminId });
__emit(true);
`, { adminId });
}

export async function cleanupExpiredSessions(): Promise<number> {
  await ensureAuthIndexes();
  return runMongoScript<number>(`
const result = db.adminSessions.deleteMany({
  expiresAt: { $lt: new Date().toISOString() }
});
__emit(result.deletedCount);
`, {});
}

export async function getAdminSessionCount(adminId: string): Promise<number> {
  await ensureAuthIndexes();
  return runMongoScript<number>(`
const count = db.adminSessions.countDocuments({
  adminId: __payload.adminId,
  expiresAt: { $gt: new Date().toISOString() }
});
__emit(count);
`, { adminId });
}