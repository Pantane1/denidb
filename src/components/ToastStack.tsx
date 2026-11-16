import React from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useDeniBook } from '../lib/store';

export const ToastStack: React.FC = () => {
  const { toasts, dismissToast } = useDeniBook();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-16 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-lg border text-sm font-medium transition-all duration-150 ${
            toast.tone === 'error'
              ? 'bg-red-900 text-white border-red-700'
              : toast.tone === 'info'
                ? 'bg-stone-900 text-white border-stone-700 dark:bg-stone-800'
                : 'bg-teal-800 text-white border-teal-700'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : toast.tone === 'info' ? (
              <Info className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
