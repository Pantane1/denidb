import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useDeniBook } from '../lib/store';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingOpsCount, isSyncing, syncNow } = useDeniBook();

  if (isOnline && pendingOpsCount === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs font-medium border ${
          !isOnline
            ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200'
            : 'bg-teal-50 border-teal-200 text-teal-900 dark:bg-teal-950/40 dark:border-teal-800/60 dark:text-teal-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!isOnline ? (
            <WifiOff className="w-4 h-4 shrink-0" />
          ) : (
            <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          )}
          <span className="truncate">
            {!isOnline
              ? 'Offline Mode — Sales save locally and sync automatically when back online.'
              : `${pendingOpsCount} pending ${pendingOpsCount === 1 ? 'change' : 'changes'} waiting to sync.`}
          </span>
        </div>
        {isOnline && pendingOpsCount > 0 && (
          <button
            type="button"
            onClick={syncNow}
            disabled={isSyncing}
            className="min-h-[36px] px-3 py-1 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
};
