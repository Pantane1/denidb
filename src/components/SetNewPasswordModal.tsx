import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useDeniBook } from '../lib/store';

export const SetNewPasswordModal: React.FC = () => {
  const { completePasswordReset, dismissPasswordRecovery, user } = useAuth();
  const { pushToast } = useDeniBook();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter carefully.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await completePasswordReset(newPassword);
      if (res.error) {
        setError(res.error);
      } else {
        pushToast('Password updated successfully!', 'success');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set New Password"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-6 shadow-2xl">
        <div className="w-10 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-50">
              Set New Password
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
              Choose a new password for {user?.email || 'your account'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="recovery-new-password"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              New Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="recovery-new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 pl-3.5 pr-12 text-base text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="recovery-confirm-password"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              Confirm New Password
            </label>
            <input
              id="recovery-confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="mt-1.5 w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 text-base text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={dismissPasswordRecovery}
              className="min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[48px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{submitting ? 'Updating...' : 'Save New Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
