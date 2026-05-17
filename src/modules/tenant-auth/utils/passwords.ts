import { randomBytes } from 'node:crypto';
import { TENANT_AUTH_CONFIG } from '../contracts/types';

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

export function createTenantSessionToken(): string {
  return `tds_${randomBytes(TENANT_AUTH_CONFIG.sessionTokenBytes).toString('hex')}`;
}

export function createTemporaryPassword(
  length: number = TENANT_AUTH_CONFIG.temporaryPasswordLength,
): string {
  const bytes = randomBytes(length);
  let password = '';

  for (let index = 0; index < length; index += 1) {
    password += TEMP_PASSWORD_ALPHABET[bytes[index] % TEMP_PASSWORD_ALPHABET.length];
  }

  return password;
}
