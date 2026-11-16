import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { useDeniBook } from '../lib/store';

export const SummaryKPIs: React.FC = () => {
  const { kpis, settings, clients } = useDeniBook();
  const owingCount = clients.filter((c) => c.total_balance > 0).length;

  return (
    <section aria-label="Daily Ledger Summary" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
          <span>Total Owed Across All Clients</span>
          <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        </div>
        <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          {formatCurrency(kpis.totalOwed, settings.currency)}
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          {owingCount} active {owingCount === 1 ? 'account' : 'accounts'} · {clients.length} total
        </p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
          <span>Added Today</span>
          <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        </div>
        <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold tracking-tight text-rose-700 dark:text-rose-400">
          {formatCurrency(kpis.addedToday, settings.currency)}
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Credit extended today
        </p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
          <span>Collected Today</span>
          <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        </div>
        <p className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
          {formatCurrency(kpis.collectedToday, settings.currency)}
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Payments received today
        </p>
      </div>
    </section>
  );
};
