/**
 * Super Admin Authentication Service
 * Session-based authentication with bcrypt password hashing
 */

'use server';

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  AdminDocument,
  AdminSessionDocument,
  createAdmin,
  getAdminByEmail,
  getAdminById,
  getSessionByToken,
  createSession,
  deleteSession,
  deleteAllAdminSessions,
  updateAdminLastLogin,
  updateAdminPassword,
  updateSessionAccess,
  getAdminSessionCount,
} from '@/server/auth/repository';

// Session configuration
const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  admin?: AdminDocument;
  sessionToken?: string;
}

export interface SessionInfo {
  admin: AdminDocument;
  session: AdminSessionDocument;
}

/**
 * Generate cryptographically secure session token
 */
function generateSessionToken(): string {
  return uuidv4() + '-' + crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate session expiry date
 */
function getSessionExpiry(): string {
  const expiryDate = new Date(Date.now() + SESSION_EXPIRY_MS);
  return expiryDate.toISOString();
}

/**
 * Login admin with email and password
 */
export async function login(
  credentials: LoginCredentials,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthResult> {
  const { email, password } = credentials;

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Check if admin exists
  const admin = await getAdminByEmail(normalizedEmail);

  if (!admin) {
    return { success: false, error: 'Invalid email or password.' };
  }

  // Check if admin is disabled
  if (admin.status === 'disabled') {
    return { success: false, error: 'Your account has been disabled. Contact support.' };
  }

  // Verify password with bcrypt
  const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

  if (!isValidPassword) {
    return { success: false, error: 'Invalid email or password.' };
  }

  // Update last login time
  await updateAdminLastLogin(admin.id);

  // Delete any existing sessions (single session per admin)
  await deleteAllAdminSessions(admin.id);

  // Create new session
  const sessionToken = generateSessionToken();
  const expiresAt = getSessionExpiry();

  const session = await createSession(
    admin.id,
    sessionToken,
    expiresAt,
    ipAddress,
    userAgent
  );

  return {
    success: true,
    admin: {
      ...admin,
      passwordHash: '', // Don't expose password hash
    },
    sessionToken,
  };
}

/**
 * Logout admin by invalidating session
 */
export async function logout(sessionToken: string): Promise<boolean> {
  try {
    await deleteSession(sessionToken);
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}

/**
 * Validate session token and return admin info
 */
export async function validateSession(sessionToken: string): Promise<SessionInfo | null> {
  if (!sessionToken) {
    return null;
  }

  try {
    const session = await getSessionByToken(sessionToken);

    if (!session) {
      return null;
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      await deleteSession(sessionToken);
      return null;
    }

    // Get admin info
    const admin = await getAdminById(session.adminId);

    if (!admin || admin.status === 'disabled') {
      await deleteSession(sessionToken);
      return null;
    }

    // Update last accessed time
    await updateSessionAccess(sessionToken);

    return {
      admin: {
        ...admin,
        passwordHash: '', // Don't expose password hash
      },
      session,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Get current admin from session cookie
 */
export async function getCurrentAdmin(sessionToken: string): Promise<AdminDocument | null> {
  const sessionInfo = await validateSession(sessionToken);
  return sessionInfo?.admin ?? null;
}

/**
 * Check if session is valid (for middleware)
 */
export async function isAuthenticated(sessionToken: string): Promise<boolean> {
  const sessionInfo = await validateSession(sessionToken);
  return sessionInfo !== null;
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Create initial admin (for seeding)
 */
export async function createInitialAdmin(
  email: string,
  password: string,
  role: 'super_admin' | 'admin' = 'admin'
): Promise<AdminDocument> {
  // Check if admin already exists
  const existingAdmin = await getAdminByEmail(email.toLowerCase());

  if (existingAdmin) {
    throw new Error('Admin with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  return createAdmin(email.toLowerCase(), passwordHash, role);
}

/**
 * Change admin password
 */
export async function changePassword(
  adminId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await getAdminById(adminId);

  if (!admin) {
    return { success: false, error: 'Admin not found.' };
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, admin.passwordHash);

  if (!isValidPassword) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  await updateAdminPassword(adminId, newPasswordHash);

  // Invalidate all sessions
  await deleteAllAdminSessions(adminId);

  return { success: true };
}

/**
 * Get active session count for admin
 */
export async function getActiveSessionCount(adminId: string): Promise<number> {
  return getAdminSessionCount(adminId);
}