import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'full'
            ? 'w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 active:scale-[0.98] transition-all whitespace-nowrap shrink-0'
            : 'min-h-[40px] flex items-center gap-1.5 rounded-lg border border-teal-700/30 bg-teal-50 dark:bg-teal-950/40 dark:border-teal-500/30 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'full'
              ? 'w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 text-sm font-semibold text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0'
              : 'min-h-[40px] flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0'
          }
        >
          <Share className="w-4 h-4 shrink-0" />
          <span>Add to Home</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Install DeniBook on iOS"
          >
            <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Add DeniBook to Home Screen
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  aria-label="Close install guide"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-stone-600 dark:text-stone-300">
                <li>1. Tap the <strong>Share</strong> button in your Safari toolbar.</li>
                <li>2. Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>3. Tap <strong>Add</strong> to use DeniBook like a native app offline.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[48px] rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
