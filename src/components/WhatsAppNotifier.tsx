import React, { useMemo, useState } from 'react';
import { BellRing, Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import { Client, TransactionType } from '../types';
import { formatShortDate } from '../lib/currency';
import { buildWhatsAppMessage, buildWhatsAppUrl, formatPhoneDisplay } from '../lib/phone';
import { useDeniBook } from '../lib/store';

export function useClientReminderMessage(client: Client) {
  const { transactions, settings } = useDeniBook();

  return useMemo(() => {
    const clientDebts = transactions
      .filter((t) => t.client_id === client.id && t.type === TransactionType.DEBT)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const latestDate = clientDebts[0]
      ? formatShortDate(clientDebts[0].created_at)
      : formatShortDate(client.updated_at);

    const recentItems = Array.from(
      new Set(clientDebts.slice(0, 3).map((t) => t.product_name))
    ).join(', ');

    const message = buildWhatsAppMessage(settings.whatsappTemplate, {
      clientName: client.name,
      currency: settings.currency,
      totalOwed: client.total_balance,
      latestDate,
      recentItems,
    });

    const url = buildWhatsAppUrl(client.whatsapp_number, message, settings.countryCode);
    return { message, url };
  }, [client, settings.countryCode, settings.currency, settings.whatsappTemplate, transactions]);
}

interface QuickBellProps {
  client: Client;
}

export const QuickWhatsAppBell: React.FC<QuickBellProps> = ({ client }) => {
  const { url } = useClientReminderMessage(client);

  if (client.total_balance <= 0) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Notify ${client.name} on WhatsApp`}
      aria-label={`Send WhatsApp reminder to ${client.name}`}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95 transition-all shrink-0"
    >
      <BellRing className="w-4 h-4" />
    </a>
  );
};

interface WhatsAppNotifierProps {
  client: Client;
  onClose?: () => void;
}

export const WhatsAppNotifierModal: React.FC<WhatsAppNotifierProps> = ({ client, onClose }) => {
  const { settings, pushToast } = useDeniBook();
  const { message: initialMessage } = useClientReminderMessage(client);
  const [draft, setDraft] = useState(initialMessage);
  const [copied, setCopied] = useState(false);

  const customUrl = buildWhatsAppUrl(client.whatsapp_number, draft, settings.countryCode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      pushToast('Copied reminder message');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      pushToast('Unable to copy text', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="WhatsApp Payment Reminder"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 truncate">
              Notify {client.name}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-mono-num">
              {formatPhoneDisplay(client.whatsapp_number)}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              aria-label="Close reminder preview"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <label className="block mt-4 text-xs font-semibold text-stone-600 dark:text-stone-300">
          Reminder Message Preview
        </label>
        <textarea
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 py-2.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
        />

        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <a
            href={customUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Open WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
};
