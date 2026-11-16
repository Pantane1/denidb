import React, { useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { triggerHaptic, useDeniBook } from '../lib/store';

export const PinLockScreen: React.FC = () => {
  const { unlockWithPin, settings } = useDeniBook();
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (d: string) => {
    triggerHaptic(8);
    if (entered.length >= 4) return;
    const next = `${entered}${d}`;
    setEntered(next);
    setError(false);

    if (next.length === 4) {
      const ok = unlockWithPin(next);
      if (!ok) {
        triggerHaptic(35);
        setError(true);
        window.setTimeout(() => {
          setEntered('');
        }, 380);
      }
    }
  };

  const handleBackspace = () => {
    triggerHaptic(8);
    setEntered((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F5] dark:bg-[#0B0F0E] px-4 py-8">
      <div className="w-full max-w-xs text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-stone-900 dark:text-stone-50">
          {settings.shopName} Locked
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Enter your 4-digit owner PIN
        </p>

        {/* PIN Dots */}
        <div className="mt-6 flex items-center justify-center gap-4" aria-label="PIN entry">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < entered.length;
            return (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  error
                    ? 'border-rose-500 bg-rose-500'
                    : filled
                      ? 'border-teal-700 bg-teal-700 dark:border-teal-400 dark:bg-teal-400 scale-110'
                      : 'border-stone-300 dark:border-stone-700'
                }`}
              />
            );
          })}
        </div>

        <p className="mt-3 h-4 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error ? 'Incorrect PIN — try again' : ''}
        </p>

        {/* Numeric Keypad */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="min-h-[60px] rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] font-mono-num text-xl font-bold text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all"
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="min-h-[60px] rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] font-mono-num text-xl font-bold text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Delete digit"
            className="min-h-[60px] rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-6 text-xs text-stone-500 dark:text-stone-400">
          Default PIN is <span className="font-mono-num font-semibold">1234</span> until changed in Settings.
        </p>
      </div>
    </div>
  );
};
