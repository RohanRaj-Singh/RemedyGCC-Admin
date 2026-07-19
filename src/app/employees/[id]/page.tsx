'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle, ShieldAlert,
  KeyRound, Lock, ShieldX, ShieldCheck, Copy, Check,
} from 'lucide-react';

interface EmployeeDetail {
  employeeId: string;
  employeeCode: string;
  email: string;
  name: string;
  phoneNumber?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  status: 'not_registered' | 'active' | 'inactive' | 'suspended';
  tenantId: string;
  tenantName: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastAccessAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_registered: { label: 'Not Registered', color: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inactive', color: 'bg-amber-100 text-amber-700' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-700' },
};

function formatDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatBool(value: boolean) {
  return value ? 'Yes' : 'No';
}

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    type: 'reset-password' | 'suspend' | 'unsuspend';
    title: string;
    message: string;
  } | null>(null);
  const [passwordModal, setPasswordModal] = useState<{
    temporaryPassword: string;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // ── Fetch employee ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!employeeId) return;
    const fetchEmployee = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/super-admin/employees/${employeeId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Employee not found.');
          throw new Error('Failed to load employee.');
        }
        const data: EmployeeDetail = await res.json();
        setEmployee(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [employeeId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const performAction = async (action: string) => {
    setActionLoading(action);
    setActionError(null);
    try {
      const res = await fetch(`/api/super-admin/employees/${employeeId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Action failed with status ${res.status}`);
      }

      // Handle reset password response (contains temporaryPassword)
      if (action === 'reset-password') {
        setPasswordModal({ temporaryPassword: data.temporaryPassword });
        setConfirmModal(null);
        // Refresh employee data (mustChangePassword will be true)
        const refreshRes = await fetch(`/api/super-admin/employees/${employeeId}`);
        if (refreshRes.ok) {
          setEmployee(await refreshRes.json());
        }
        return;
      }

      // For other actions, refresh employee data
      if (data.success && data.employee) {
        setEmployee(data.employee);
      } else {
        // Refresh independently
        const refreshRes = await fetch(`/api/super-admin/employees/${employeeId}`);
        if (refreshRes.ok) {
          setEmployee(await refreshRes.json());
        }
      }

      setConfirmModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Confirmation handlers ──────────────────────────────────────────────────

  const openResetPasswordConfirm = () => {
    setConfirmModal({
      type: 'reset-password',
      title: 'Reset Password',
      message: 'This will generate a temporary password and force the employee to change it on next login.',
    });
  };

  const openSuspendConfirm = () => {
    setConfirmModal({
      type: 'suspend',
      title: 'Suspend Employee',
      message: 'This will prevent the employee from logging in.',
    });
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    performAction(confirmModal.type);
  };

  // ── Copy password handler ──────────────────────────────────────────────────

  const copyPassword = async () => {
    if (!passwordModal) return;
    try {
      await navigator.clipboard.writeText(passwordModal.temporaryPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = passwordModal.temporaryPassword;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 3000);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={() => router.push('/employees')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error || 'Employee not found.'}
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[employee.status] ?? STATUS_CONFIG.not_registered;
  const isLocked = employee.lockedUntil && new Date(employee.lockedUntil) > new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/employees')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </button>

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Employee Detail</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{employee.name || 'Unnamed Employee'}</h1>
          </div>
          <div className={`rounded-xl border px-4 py-2 flex items-center gap-2 ${sc.color}`}>
            <span className="text-sm font-semibold">{sc.label}</span>
          </div>
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{actionError}</p>
          </div>
        )}

        {/* ── Profile Section ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-gray-400">Full Name</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{employee.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Email</p>
              <p className="mt-0.5 text-sm text-gray-700">{employee.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Employee Code</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-gray-900">{employee.employeeCode}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Phone</p>
              <p className="mt-0.5 text-sm text-gray-700">{employee.phoneNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Bank Name</p>
              <p className="mt-0.5 text-sm text-gray-700">{employee.bankName || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-gray-400">Bank Account</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{employee.bankAccountNumber || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-gray-400">Organization</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{employee.tenantName}</p>
            </div>
          </div>
        </div>

        {/* ── Status Section ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Status</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-gray-400">Account Status</p>
              <p className="mt-0.5">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Last Access</p>
              <p className="mt-0.5 text-sm text-gray-700">{formatDate(employee.lastAccessAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Created</p>
              <p className="mt-0.5 text-sm text-gray-700">{formatDate(employee.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Updated</p>
              <p className="mt-0.5 text-sm text-gray-700">{formatDate(employee.updatedAt)}</p>
            </div>
          </div>
        </div>

        {/* ── Security Section ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Security</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-gray-400">Failed Login Attempts</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{employee.failedLoginAttempts}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Locked Until</p>
              <p className="mt-0.5 text-sm text-gray-700">
                {isLocked ? formatDate(employee.lockedUntil) : 'Not locked'}
                {isLocked && <Lock className="inline-block ml-1 h-3.5 w-3.5 text-amber-500" />}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Must Change Password</p>
              <p className="mt-0.5 text-sm text-gray-700">
                {employee.mustChangePassword ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Yes
                  </span>
                ) : (
                  'No'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Actions</h3>
          <div className="flex flex-wrap gap-3">
            {/* Reset Password */}
            <button
              type="button"
              onClick={openResetPasswordConfirm}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4 text-amber-500" />
              Reset Password
            </button>

            {/* Unlock — only show if currently locked */}
            {isLocked && (
              <button
                type="button"
                onClick={() => performAction('unlock')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Lock className="h-4 w-4 text-amber-500" />
                Unlock
              </button>
            )}

            {/* Suspend — only if not already suspended */}
            {employee.status !== 'suspended' && (
              <button
                type="button"
                onClick={openSuspendConfirm}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <ShieldX className="h-4 w-4" />
                Suspend
              </button>
            )}

            {/* Unsuspend — only if currently suspended */}
            {employee.status === 'suspended' && (
              <button
                type="button"
                onClick={() => performAction('unsuspend')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-600 shadow-sm hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                Unsuspend
              </button>
            )}

            {actionLoading && (
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            )}
          </div>
        </div>

        <div className="text-center border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400">
            Employee ID: {employee.employeeId}
          </p>
        </div>
      </div>

      {/* ── Confirmation Modal ───────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="h-6 w-6 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900">{confirmModal.title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setConfirmModal(null); setActionError(null); }}
                disabled={actionLoading !== null}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionLoading === confirmModal.type && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Temporary Password Modal ──────────────────────────────────────── */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-emerald-500" />
              <h3 className="text-lg font-semibold text-gray-900">Password Reset</h3>
            </div>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              This password will only be shown once. Share it securely with the employee.
            </p>
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-400 mb-1">Temporary Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-lg font-bold text-gray-900 select-all">
                  {passwordModal.temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Copy to clipboard"
                >
                  {passwordCopied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              {passwordCopied && (
                <p className="mt-1 text-xs text-emerald-600 font-medium">Copied to clipboard</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPasswordModal(null)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
