import React, { useState } from 'react';
import { ArrowLeft, BookOpenCheck, Eye, EyeOff, KeyRound, Loader2, Store } from 'lucide-react';
import { useAuth } from '../lib/auth';

type AuthMode = 'signin' | 'signup' | 'forgot';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, requestPasswordReset, isSupabaseMode } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Enter your account email address.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await requestPasswordReset(email);
        if (res.error) {
          setError(res.error);
        } else {
          setInfoMessage(
            'Password reset link sent! Check your email inbox or spam folder.'
          );
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (!shopName.trim()) {
        setError('Enter your shop or business name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.error) setError(res.error);
      } else {
        const res = await signUp(email, password, shopName);
        if (res.error) {
          setError(res.error);
        } else if (res.needsEmailConfirmation) {
          setInfoMessage(
            'Account created. Check your email inbox to confirm your address, then sign in.'
          );
          setMode('signin');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F5] dark:bg-[#0B0F0E] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-6 sm:p-8 shadow-xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center shrink-0">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-50 tracking-tight">
              DeniBook
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              Your private shop credit &amp; debt ledger
            </p>
          </div>
        </div>

        {/* Mode Switcher or Reset Password Header */}
        {mode === 'forgot' ? (
          <div className="mt-6 flex items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-[#1E2724]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Reset Password
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setInfoMessage('');
              }}
              className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        ) : (
          <div
            className="mt-6 grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#19221F] border border-stone-200 dark:border-[#222B28]"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className={`min-h-[42px] rounded-lg text-sm font-semibold transition-colors ${
                mode === 'signin'
                  ? 'bg-white dark:bg-[#24302C] text-stone-900 dark:text-stone-50 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => {
                setMode('signup');
                setError('');
                setInfoMessage('');
              }}
              className={`min-h-[42px] rounded-lg text-sm font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-white dark:bg-[#24302C] text-stone-900 dark:text-stone-50 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === 'forgot' && (
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              Enter the email address for your DeniBook shop account and we will send you a secure
              password reset link.
            </p>
          )}

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-shop-name"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                Shop / Business Name
              </label>
              <div className="relative mt-1.5">
                <Store className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-shop-name"
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Kamau Agrovet"
                  className="w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 pl-10 pr-3.5 text-base text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@myshop.com"
              className="mt-1.5 w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 text-base text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
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
              {mode === 'signin' && (
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setInfoMessage('');
                    }}
                    className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline py-1"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              {infoMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[50px] rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {submitting
                ? mode === 'forgot'
                  ? 'Sending reset link...'
                  : mode === 'signin'
                    ? 'Signing in...'
                    : 'Creating shop...'
                : mode === 'forgot'
                  ? 'Send Reset Link'
                  : mode === 'signin'
                    ? 'Sign In to My Book'
                    : 'Create My Shop Book'}
            </span>
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-stone-500 dark:text-stone-400">
          {isSupabaseMode
            ? 'Your customer ledger is backed up privately to your shop account.'
            : 'Offline preview mode · Create an account to test isolated shop books.'}
        </p>
      </div>

      <p className="mt-5 text-center text-xs text-stone-500 dark:text-stone-400">
        DeniBook is a product of{' '}
        <a
          href="https://pantane.is-a.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal-700 dark:text-teal-400 hover:underline"
        >
          Pantane Hub
        </a>
      </p>
    </div>
  );
};
