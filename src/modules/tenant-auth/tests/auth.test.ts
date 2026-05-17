import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TENANT_AUTH_CONFIG } from '../contracts/types';
import { createTenantAuthTestContext } from './fixtures';
import {
  TENANT_LOGIN_PATH,
  isTenantProtectedPath,
  isTenantPublicPath,
  isValidTenantSessionTokenFormat,
} from '../middleware/route-protection';

describe('Tenant Auth Service', () => {
  it('logs in an active tenant owner and creates a server session', async () => {
    const context = await createTenantAuthTestContext();
    const result = await context.service.loginTenantUser(
      {
        identifier: 'owner@active.test',
        password: 'OwnerPass123!',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'tenant-auth-test',
      },
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.email, 'owner@active.test');
    assert.equal(result.session?.tenantId, 'tenant-active');
    assert.equal(result.requiresPasswordChange, false);
    assert.ok(result.session?.sessionToken);
    assert.equal(context.users.get('tenant-user-active')?.lastLoginAt, context.nowIso);
  });

  it('invalidates a session on logout', async () => {
    const context = await createTenantAuthTestContext();
    const loginResult = await context.service.loginTenantUser({
      identifier: 'active.owner',
      password: 'OwnerPass123!',
    });

    assert.equal(loginResult.success, true);
    assert.ok(loginResult.session);

    await context.service.invalidateTenantSession(loginResult.session!.sessionToken);
    assert.equal(context.sessions.has(loginResult.session!.sessionToken), false);
  });

  it('blocks login for disabled, archived, and draft tenants', async () => {
    const context = await createTenantAuthTestContext();

    const disabled = await context.service.loginTenantUser({
      identifier: 'owner@disabled.test',
      password: 'OwnerPass123!',
    });
    const archived = await context.service.loginTenantUser({
      identifier: 'owner@archived.test',
      password: 'OwnerPass123!',
    });
    const draft = await context.service.loginTenantUser({
      identifier: 'owner@draft.test',
      password: 'OwnerPass123!',
    });

    assert.equal(disabled.success, false);
    assert.equal(disabled.reason, 'TENANT_DISABLED');
    assert.equal(archived.success, false);
    assert.equal(archived.reason, 'TENANT_ARCHIVED');
    assert.equal(draft.success, false);
    assert.equal(draft.reason, 'TENANT_DRAFT');
  });

  it('invalidates expired sessions during validation', async () => {
    const context = await createTenantAuthTestContext();
    const expiredToken = 'tds_expired_session_token_0000000000000000000000000000000000000000000000';

    const result = await context.service.validateTenantSession(expiredToken);

    assert.equal(result, null);
    assert.equal(context.sessions.has(expiredToken), false);
  });

  it('resets tenant passwords with a temporary password and forces a password change', async () => {
    const context = await createTenantAuthTestContext();

    const loginResult = await context.service.loginTenantUser({
      identifier: 'owner@active.test',
      password: 'OwnerPass123!',
    });
    assert.equal(loginResult.success, true);

    const resetResult = await context.service.resetTenantDashboardPassword('tenant-active');
    assert.equal(resetResult.mustChangePassword, true);
    assert.equal(context.sessions.size, 0);

    const forcedLogin = await context.service.loginTenantUser({
      identifier: 'active.owner',
      password: resetResult.temporaryPassword,
    });

    assert.equal(forcedLogin.success, true);
    assert.equal(forcedLogin.requiresPasswordChange, true);

    const changedUser = await context.service.changeTenantPassword(
      forcedLogin.user!.id,
      {
        currentPassword: resetResult.temporaryPassword,
        newPassword: 'NewOwnerPass123!',
      },
    );

    assert.equal(changedUser.mustChangePassword, false);
  });

  it('supports create, disable, and reactivate flows for dashboard access management', async () => {
    const context = await createTenantAuthTestContext();

    const created = await context.service.createTenantDashboardAccess({
      tenantId: 'tenant-provisioning',
      email: 'owner@provisioning.test',
      username: 'provisioning.owner',
      password: 'ProvisionedPass123!',
    });

    assert.equal(created.hasCredentials, true);
    assert.equal(created.user?.status, 'active');

    const disabled = await context.service.disableTenantDashboardAccess('tenant-provisioning');
    assert.equal(disabled.user?.status, 'disabled');

    const reactivated = await context.service.reactivateTenantDashboardAccess('tenant-provisioning');
    assert.equal(reactivated.user?.status, 'active');
  });

  it('rate limits repeated invalid login attempts', async () => {
    const context = await createTenantAuthTestContext();

    for (let attempt = 0; attempt < TENANT_AUTH_CONFIG.maxLoginAttempts; attempt += 1) {
      const result = await context.service.loginTenantUser(
        {
          identifier: 'owner@active.test',
          password: 'WrongPass123!',
        },
        {
          ipAddress: '127.0.0.1',
        },
      );

      assert.equal(result.success, false);
    }

    const blocked = await context.service.loginTenantUser(
      {
        identifier: 'owner@active.test',
        password: 'WrongPass123!',
      },
      {
        ipAddress: '127.0.0.1',
      },
    );

    assert.equal(blocked.success, false);
    assert.equal(blocked.reason, 'RATE_LIMITED');
    assert.ok((blocked.retryAfterSeconds ?? 0) > 0);
  });
});

describe('Tenant Route Protection Helpers', () => {
  it('protects only tenant portal paths', () => {
    assert.equal(isTenantProtectedPath('/dashboard'), true);
    assert.equal(isTenantProtectedPath('/dashboard/settings'), true);
    assert.equal(isTenantProtectedPath('/analytics'), true);
    assert.equal(isTenantProtectedPath('/reports/monthly'), true);
    assert.equal(isTenantProtectedPath('/scanners'), false);
    assert.equal(isTenantProtectedPath('/tenants'), false);
  });

  it('keeps the tenant login path public and validates token format', () => {
    assert.equal(isTenantPublicPath(TENANT_LOGIN_PATH), true);
    assert.equal(isTenantPublicPath('/tenant-login/help'), true);
    assert.equal(isValidTenantSessionTokenFormat(`tds_${'a'.repeat(64)}`), true);
    assert.equal(isValidTenantSessionTokenFormat('admin-session-token'), false);
    assert.notEqual(TENANT_AUTH_CONFIG.sessionCookieName, 'admin_session');
  });
});
