import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

type AuthMode = 'signin' | 'signup' | 'forgot';

interface StrengthInfo {
  bars: 0 | 1 | 2 | 3;
  label: string;
  barClass: string;
  textClass: string;
}

function evaluatePasswordStrength(password: string): StrengthInfo {
  if (!password) {
    return {
      bars: 0,
      label: 'Minimum 6 characters',
      barClass: 'bg-stone-200 dark:bg-stone-700',
      textClass: 'text-stone-500 dark:text-stone-400',
    };
  }
  if (password.length < 6) {
    return {
      bars: 1,
      label: 'Weak',
      barClass: 'bg-rose-500',
      textClass: 'text-rose-600 dark:text-rose-400',
    };
  }
  const hasMixed = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[\d\W_]/.test(password);
  if (password.length >= 8 && (hasMixed || hasNumberOrSymbol)) {
    return {
      bars: 3,
      label: 'Strong',
      barClass: 'bg-emerald-600',
      textClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }
  return {
    bars: 2,
    label: 'Good',
    barClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
  };
}

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

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfoMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your account email address.');
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

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (!shopName.trim()) {
        setError('Please enter your shop or business name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const res = await signIn(normalizedEmail, password);
        if (res.error) setError(res.error);
      } else {
        const res = await signUp(normalizedEmail, password, shopName);
        if (res.duplicateEmail) {
          setMode('signin');
          setInfoMessage('');
          setError(
            res.error ||
              "An account with this email already exists. Please sign in or use 'Forgot password?' to reset your password."
          );
        } else if (res.error) {
          setError(res.error);
        } else if (res.needsEmailConfirmation) {
          setInfoMessage(
            'Account created! Check your email inbox to confirm your address, then sign in.'
          );
          setMode('signin');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const headingText =
    mode === 'signin'
      ? 'Welcome back'
      : mode === 'signup'
        ? 'Create your account'
        : 'Reset password';

  const subtitleText =
    mode === 'signin'
      ? 'Welcome back! Please enter your shop details.'
      : mode === 'signup'
        ? 'Start tracking your shop credit & debts in seconds.'
        : 'Enter your email and we will send you a reset link.';

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2 bg-white dark:bg-[#0E1312]">
      {/* Left Panel: Clean White Full-Height Auth Column */}
      <div className="flex-1 flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 lg:px-14 lg:py-10 bg-white dark:bg-[#0E1312]">
        {/* Top-Left Brand Lockup */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <BookOpenCheck className="w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-50">
              DeniBook
            </span>
          </div>

          {!isSupabaseMode && (
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Preview mode
            </span>
          )}
        </header>

        {/* Centered Compact Auth Form */}
        <main className="w-full max-w-[360px] mx-auto my-auto py-10">
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
          )}

          <div>
            <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-tight">
              {headingText}
            </h1>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {subtitleText}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-shop-name"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
                >
                  Shop / Business Name
                </label>
                <input
                  id="auth-shop-name"
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Kamau Agrovet"
                  className="mt-1.5 w-full h-11 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141A18] px-3.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 dark:focus:border-teal-500 dark:focus:ring-teal-500/15 transition-all"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="mt-1.5 w-full h-11 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141A18] px-3.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 dark:focus:border-teal-500 dark:focus:ring-teal-500/15 transition-all"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
                  >
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="relative mt-1.5">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Create a password' : '••••••••'}
                    className="w-full h-11 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141A18] pl-3.5 pr-11 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 dark:focus:border-teal-500 dark:focus:ring-teal-500/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="h-9 w-9 flex items-center justify-center rounded-md absolute right-1 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === 'signup' && password.length > 0 && (
                  <div className="mt-2 space-y-1" aria-live="polite">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`h-1 rounded-full transition-colors ${
                            strength.bars >= step
                              ? strength.barClass
                              : 'bg-stone-200 dark:bg-stone-800'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-medium ${strength.textClass}`}>
                        {strength.label}
                      </span>
                      <span className="text-stone-400 dark:text-stone-500">
                        Min. 6 characters
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {error}
              </div>
            )}

            {infoMessage && (
              <div
                role="status"
                className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300"
              >
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-xs hover:shadow-md hover:shadow-teal-900/10 active:scale-[0.99] transition-all"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {submitting
                  ? mode === 'forgot'
                    ? 'Sending reset link...'
                    : mode === 'signin'
                      ? 'Signing in...'
                      : 'Creating account...'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : mode === 'signin'
                      ? 'Sign in'
                      : 'Create account'}
              </span>
            </button>
          </form>

          {/* Compact Mode Switcher Footer Link */}
          {mode !== 'forgot' && (
            <p className="mt-6 text-center text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              {mode === 'signin' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline transition-colors"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:underline transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          )}
        </main>

        {/* Bottom-Left Minimal Attribution Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 dark:text-stone-500">
          <span>
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://pantane.is-a.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            >
              DeniBook · Pantane Hub
            </a>
          </span>

          <a
            href="https://wa.me/254740312402?text=Hi%20Pantane%20Hub%2C%20I%20need%20help%20with%20DeniBook."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-stone-500 dark:text-stone-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Need help?</span>
          </a>
        </footer>
      </div>

      {/* Right Panel: Soft Lavender Canvas with Pure CSS 3D Horizon Sphere */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex group relative items-center justify-center overflow-hidden bg-[#F4F3F8] dark:bg-[#13141E]"
      >
        {/* Subtle Ambient Lavender Glow */}
        <div className="pointer-events-none absolute w-[460px] h-[460px] rounded-full bg-gradient-to-tr from-[#C4B5FD]/35 via-[#A78BFA]/20 to-[#5EEAD4]/20 blur-3xl" />

        {/* Pure CSS 3D Gradient Sphere */}
        <div className="relative flex items-center justify-center w-full h-full">
          <div className="relative w-60 h-60 xl:w-64 xl:h-64 rounded-full bg-gradient-to-br from-[#7C3AED] via-[#5B21B6] to-[#0F766E] shadow-[0_24px_60px_-15px_rgba(91,33,182,0.45)] transition-transform duration-500 ease-out group-hover:scale-[1.03]">
            {/* Subtle specular rim highlight */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/5 to-white/25" />
          </div>

          {/* Frosted Glass Horizon Reflection Shelf (Lower Hemisphere Diffusion) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 bg-[#F4F3F8]/60 dark:bg-[#13141E]/65 backdrop-blur-2xl border-t border-white/60 dark:border-white/10" />
        </div>
      </aside>
    </div>
  );
};
