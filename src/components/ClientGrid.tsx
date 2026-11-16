import React, { useMemo, useState } from 'react';
import { Check, FileText, Search, UserPlus, Users, X } from 'lucide-react';
import { Client, ClientFilter } from '../types';
import { formatCurrency, formatShortDate } from '../lib/currency';
import { formatPhoneDisplay } from '../lib/phone';
import { triggerHaptic, useDeniBook } from '../lib/store';
import { QuickWhatsAppBell } from './WhatsAppNotifier';

interface ClientGridProps {
  selectedIds: string[];
  onToggleSelect: (clientId: string) => void;
  onClearSelection: () => void;
  onOpenProfile: (client: Client) => void;
  onOpenAddClient: () => void;
}

export const ClientGrid: React.FC<ClientGridProps> = ({
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onOpenProfile,
  onOpenAddClient,
}) => {
  const { clients, settings } = useDeniBook();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => {
        if (filter === 'owing' && c.total_balance <= 0) return false;
        if (filter === 'settled' && c.total_balance > 0) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.whatsapp_number.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Put owing clients first, then alphabetical
        if (a.total_balance > 0 && b.total_balance <= 0) return -1;
        if (a.total_balance <= 0 && b.total_balance > 0) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [clients, filter, query]);

  const isSplitMode = selectedIds.length >= 2;

  return (
    <section aria-label="Customer Ledger Grid" className="space-y-4">
      {/* Toolbar: Search + Filter + Add Client */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name or phone..."
            aria-label="Search customers"
            className="w-full min-h-[48px] rounded-xl border border-stone-200 dark:border-[#222B28] bg-white dark:bg-[#131917] pl-10 pr-10 text-sm sm:text-base text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2.5 flex-wrap">
          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-stone-200/70 dark:bg-[#19221F] border border-stone-200 dark:border-[#222B28]"
            role="tablist"
            aria-label="Filter clients"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'owing', label: 'Owing' },
                { id: 'settled', label: 'Settled' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-white dark:bg-[#24302C] text-stone-900 dark:text-stone-50 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenAddClient}
            className="min-h-[48px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 text-sm font-semibold flex items-center gap-2 hover:bg-stone-800 dark:hover:bg-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Selection Banner */}
      {selectedIds.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-teal-900 dark:text-teal-200 min-w-0">
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {isSplitMode
                ? `Split Mode active · ${selectedIds.length} customers selected`
                : '1 customer selected · Tap more customers to split a sale'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearSelection}
            className="min-h-[36px] px-3 rounded-lg text-xs font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 whitespace-nowrap shrink-0"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Tap a customer card to record a credit sale. Tap multiple cards to split equally.
        </p>
      )}

      {/* Customer Cards Grid */}
      {filteredClients.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-8 text-center">
          <p className="text-base font-semibold text-stone-800 dark:text-stone-100">
            {clients.length === 0 ? 'No customers yet' : 'No matching customers'}
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {clients.length === 0
              ? 'Add your first customer to start recording credit in 3 taps.'
              : 'Try adjusting your search or filter.'}
          </p>
          {clients.length === 0 && (
            <button
              type="button"
              onClick={onOpenAddClient}
              className="mt-4 min-h-[48px] px-5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add First Client</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredClients.map((client) => {
            const isSelected = selectedIds.includes(client.id);
            const hasDebt = client.total_balance > 0;

            return (
              <div
                key={client.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => {
                  triggerHaptic(8);
                  onToggleSelect(client.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerHaptic(8);
                    onToggleSelect(client.id);
                  }
                }}
                className={`group relative rounded-2xl p-4 cursor-pointer select-none transition-all duration-150 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isSelected
                    ? 'bg-teal-50/80 dark:bg-teal-950/35 border-teal-600 dark:border-teal-500 ring-1 ring-teal-600 dark:ring-teal-500'
                    : 'bg-white dark:bg-[#131917] border-stone-200 dark:border-[#222B28] hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                {/* Top row: Name + Selection check */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-50 truncate">
                      {client.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 font-mono-num truncate">
                      {formatPhoneDisplay(client.whatsapp_number)}
                    </p>
                  </div>

                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>

                {/* Bottom row: Balance + Action buttons */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#1E2724] flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold ${
                        hasDebt
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {hasDebt ? 'Owes' : 'Settled'} · {formatShortDate(client.updated_at)}
                    </p>
                    <p
                      className={`mt-0.5 font-mono-num text-xl font-bold tracking-tight ${
                        hasDebt
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(client.total_balance, settings.currency)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <QuickWhatsAppBell client={client} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(client);
                      }}
                      aria-label={`Open ledger for ${client.name}`}
                      title="View ledger & record payment"
                      className="min-h-[44px] min-w-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all text-xs font-semibold"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Ledger</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
