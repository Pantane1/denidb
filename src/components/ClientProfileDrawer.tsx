import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Edit3,
  MessageCircle,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Client, TransactionType } from '../types';
import { getCreditHealth } from '../lib/credit';
import {
  formatCurrency,
  formatLedgerDateTime,
  formatNumber,
  formatShortDate,
  roundCurrency,
} from '../lib/currency';
import { formatPhoneDisplay } from '../lib/phone';
import { useDeniBook } from '../lib/store';
import { AddClientModal } from './AddClientModal';
import { PaymentModal } from './PaymentModal';
import { WhatsAppNotifierModal } from './WhatsAppNotifier';

interface ClientProfileDrawerProps {
  clientId: string;
  onClose: () => void;
  onSelectClient?: (clientId: string) => void;
}

export const ClientProfileDrawer: React.FC<ClientProfileDrawerProps> = ({
  clientId,
  onClose,
  onSelectClient,
}) => {
  const { clients, transactions, settings, voidTransaction, deleteClient } = useDeniBook();
  const [showPayment, setShowPayment] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [voidTargetId, setVoidTargetId] = useState<string | null>(null);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);

  const client: Client | undefined = clients.find((c) => c.id === clientId);

  const ledgerEntries = useMemo(() => {
    const clientTxs = transactions
      .filter((t) => t.client_id === clientId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let running = 0;
    const withRunning = clientTxs.map((tx) => {
      const delta = tx.type === TransactionType.DEBT ? tx.amount : -tx.amount;
      running = roundCurrency(Math.max(0, running + delta));
      return { ...tx, runningBalance: running };
    });

    // Display newest first
    return withRunning.reverse();
  }, [clientId, transactions]);

  if (!client) return null;

  const hasDebt = client.total_balance > 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex justify-end items-end sm:items-stretch"
        role="dialog"
        aria-modal="true"
        aria-label={`${client.name} ledger profile`}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-lg bg-white dark:bg-[#131917] border-t sm:border-t-0 sm:border-l border-stone-200 dark:border-[#222B28] rounded-t-3xl sm:rounded-none h-[90vh] sm:h-full flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile sheet drag bar */}
          <div className="w-10 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-stone-200 dark:border-[#222B28] shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-50 truncate">
                  {client.name}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-mono-num">
                  {formatPhoneDisplay(client.whatsapp_number)} · Last activity{' '}
                  {formatShortDate(client.updated_at)}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditClient(true)}
                  aria-label="Edit client details"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteClient(true)}
                  aria-label="Delete client"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close client profile"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Balance Card */}
            <div className="mt-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    Total Outstanding Balance
                  </p>
                  <p
                    className={`mt-1 font-mono-num text-2xl sm:text-3xl font-bold ${
                      hasDebt
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {formatCurrency(client.total_balance, settings.currency)}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold ${
                    hasDebt
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {hasDebt ? 'Active Credit' : 'All Settled'}
                </span>
              </div>

              {(() => {
                const health = getCreditHealth(client.total_balance, client.credit_limit);
                if (!health.hasLimit || !client.credit_limit) return null;
                return (
                  <div className="pt-2.5 border-t border-stone-200/80 dark:border-stone-800">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className="font-mono-num text-stone-700 dark:text-stone-300">
                        Limit: {settings.currency} {formatNumber(client.total_balance)} /{' '}
                        {formatNumber(client.credit_limit)} ({health.percent}%)
                      </span>
                      <span className={health.textClass}>{health.label}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${health.barClass}`}
                        style={{ width: `${health.clampedPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowPayment(true)}
                className="min-h-[48px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Banknote className="w-4 h-4" />
                <span>Record Payment</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWhatsAppModal(true)}
                className="min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Notify WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Chronological Ledger */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Transaction History
              </h3>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-mono-num">
                {ledgerEntries.length} {ledgerEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-6 text-center text-sm text-stone-500 dark:text-stone-400">
                No transactions recorded yet for {client.name}.
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-[#1E2724]">
                {ledgerEntries.map((entry) => {
                  const isDebt = entry.type === TransactionType.DEBT;
                  const description = isDebt
                    ? `${entry.quantity}x ${entry.product_name}${
                        entry.note ? ` · ${entry.note}` : ''
                      }`
                    : `${entry.product_name === 'Deposit' ? 'Deposit Paid' : 'Payment'}${
                        entry.note ? ` · ${entry.note}` : ''
                      }`;

                  return (
                    <li
                      key={entry.id}
                      className="py-3.5 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                            {description}
                          </p>
                          {!isDebt && (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border whitespace-nowrap ${
                                entry.payment_method === 'MPESA'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                              }`}
                            >
                              {entry.payment_method === 'MPESA' ? 'M-Pesa' : 'Cash'}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 font-mono-num">
                          {formatLedgerDateTime(entry.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p
                            className={`font-mono-num text-sm font-bold ${
                              isDebt
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isDebt ? '+' : '-'}
                            {formatCurrency(entry.amount, settings.currency)}
                          </p>
                          <p className="text-xs text-stone-500 dark:text-stone-400 font-mono-num">
                            Bal: {formatCurrency(entry.runningBalance, settings.currency)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setVoidTargetId(entry.id)}
                          aria-label={`Void ${description}`}
                          title="Void / Undo entry"
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal client={client} onClose={() => setShowPayment(false)} />
      )}

      {/* WhatsApp Preview Modal */}
      {showWhatsAppModal && (
        <WhatsAppNotifierModal
          client={client}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {/* Edit Client Modal */}
      {showEditClient && (
        <AddClientModal
          existingClient={client}
          onClose={() => setShowEditClient(false)}
          onOpenExistingClient={
            onSelectClient ? (existing) => onSelectClient(existing.id) : undefined
          }
        />
      )}

      {/* Void Transaction Confirmation */}
      {voidTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm void entry"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Void this ledger entry?
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-300">
              Removing this entry will automatically recalculate {client.name}&apos;s running
              balance.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setVoidTargetId(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200"
              >
                Keep Entry
              </button>
              <button
                type="button"
                onClick={async () => {
                  await voidTransaction(voidTargetId);
                  setVoidTargetId(null);
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
              >
                Void Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation */}
      {confirmDeleteClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete client"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Delete {client.name}?
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-300">
              This removes the customer and their full ledger history from your book.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteClient(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await deleteClient(client.id);
                  setConfirmDeleteClient(false);
                  if (ok) onClose();
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
              >
                Delete Client
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
