import React from 'react';
import { Check, RefreshCw, WifiOff } from 'lucide-react';
import { useDeniBook } from '../lib/store';

export const SyncStatusPill: React.FC = () => {
  const { isOnline, pendingOpsCount, isSyncing, justSynced, syncNow } = useDeniBook();

  if (isSyncing && (pendingOpsCount > 0 || !isOnline)) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 whitespace-nowrap shrink-0"
        aria-live="polite"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-3 py-1 text-xs font-semibold text-stone-700 dark:text-stone-200 whitespace-nowrap shrink-0"
        aria-live="polite"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (!isOnline || pendingOpsCount > 0) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 pl-3 pr-1.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200 whitespace-nowrap shrink-0">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>
          {!isOnline
            ? `Offline (${pendingOpsCount} pending)`
            : `${pendingOpsCount} pending`}
        </span>
        {isOnline && pendingOpsCount > 0 && (
          <button
            type="button"
            onClick={syncNow}
            className="ml-1 rounded-full bg-amber-700 hover:bg-amber-800 text-white px-2.5 py-0.5 text-[11px] font-bold transition-colors"
          >
            Sync Now
          </button>
        )}
      </div>
    );
  }

  if (justSynced) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 whitespace-nowrap shrink-0"
        aria-live="polite"
      >
        <Check className="w-3.5 h-3.5 shrink-0" />
        <span>Synced</span>
      </div>
    );
  }

  return null;
};
