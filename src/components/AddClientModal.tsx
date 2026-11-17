import React, { useMemo, useState } from 'react';
import { ArrowRight, Phone, ShieldAlert, UserPlus, X } from 'lucide-react';
import { Client } from '../types';
import { formatPhoneDisplay, isValidWhatsAppNumber, normalizePhoneNumber } from '../lib/phone';
import { useDeniBook } from '../lib/store';

interface AddClientModalProps {
  existingClient?: Client | null;
  onClose: () => void;
  onSaved?: (client: Client) => void;
  onOpenExistingClient?: (client: Client) => void;
}

const LIMIT_PRESETS = [500, 1000, 2000];

export const AddClientModal: React.FC<AddClientModalProps> = ({
  existingClient,
  onClose,
  onSaved,
  onOpenExistingClient,
}) => {
  const { addClient, updateClient, findDuplicateClientByPhone, pushToast, settings } = useDeniBook();
  const [name, setName] = useState(existingClient?.name ?? '');
  const [phone, setPhone] = useState(existingClient?.whatsapp_number ?? '');
  const [creditLimitInput, setCreditLimitInput] = useState(
    existingClient?.credit_limit ? String(existingClient.credit_limit) : ''
  );
  const [error, setError] = useState('');
  const [duplicateClient, setDuplicateClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sanitized = normalizePhoneNumber(phone, settings.countryCode);
  const validPhone = isValidWhatsAppNumber(phone, settings.countryCode);

  const liveDuplicate = useMemo(
    () => (validPhone ? findDuplicateClientByPhone(sanitized, existingClient?.id) : null),
    [existingClient?.id, findDuplicateClientByPhone, sanitized, validPhone]
  );

  const parsedLimit = creditLimitInput.trim() === '' ? null : Number(creditLimitInput);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setError('Please enter the customer name.');
      setDuplicateClient(null);
      return;
    }
    if (!validPhone) {
      setError('Enter a valid phone number (e.g. 0712345678).');
      setDuplicateClient(null);
      return;
    }

    const match = findDuplicateClientByPhone(sanitized, existingClient?.id);
    if (match) {
      const dupMsg = `This WhatsApp number is already registered to ${match.name}. Open their profile instead.`;
      setDuplicateClient(match);
      setError(dupMsg);
      pushToast(dupMsg, 'error');
      return;
    }

    if (parsedLimit !== null && (Number.isNaN(parsedLimit) || parsedLimit <= 0)) {
      setError('Credit limit must be greater than 0, or leave blank for unlimited.');
      setDuplicateClient(null);
      return;
    }

    setSubmitting(true);
    try {
      if (existingClient) {
        const ok = await updateClient(existingClient.id, name, sanitized, parsedLimit);
        if (ok) onClose();
      } else {
        const created = await addClient(name, sanitized, parsedLimit);
        if (created) {
          onSaved?.(created);
          onClose();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={existingClient ? 'Edit Client' : 'Add New Client'}
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                {existingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                WhatsApp numbers auto-format with +{settings.countryCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="client-name"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              Customer Name
            </label>
            <input
              id="client-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Mama Njeri"
              className="mt-1.5 w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 text-base text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="client-phone"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              WhatsApp Phone Number
            </label>
            <div className="relative mt-1.5">
              <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="client-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                  setDuplicateClient(null);
                }}
                placeholder="0712 345 678"
                className="w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 pl-10 pr-3.5 text-base font-mono-num text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            {sanitized && (
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400 font-mono-num">
                WhatsApp link preview: {formatPhoneDisplay(sanitized)}{' '}
                {validPhone ? '· Valid' : '· Keep typing'}
              </p>
            )}
            {!error && liveDuplicate && (
              <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                This WhatsApp number is already registered to {liveDuplicate.name}. Open their profile instead.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="client-credit-limit"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              Credit Limit (Optional)
            </label>
            <div className="relative mt-1.5">
              <ShieldAlert className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="client-credit-limit"
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                value={creditLimitInput}
                onChange={(e) => {
                  setCreditLimitInput(e.target.value);
                  setError('');
                }}
                placeholder={`Unlimited (${settings.currency})`}
                className="w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 pl-10 pr-3.5 text-base font-mono-num text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LIMIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCreditLimitInput(String(preset))}
                  className={`min-h-[34px] px-2.5 rounded-lg text-xs font-mono-num font-semibold border transition-colors ${
                    creditLimitInput === String(preset)
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreditLimitInput('')}
                className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                  creditLimitInput === ''
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 border-stone-900 dark:border-stone-100'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                Unlimited
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-3.5 py-2.5 space-y-2"
            >
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>
              {(duplicateClient || liveDuplicate) && onOpenExistingClient && (
                <button
                  type="button"
                  onClick={() => {
                    const target = duplicateClient || liveDuplicate;
                    if (target) {
                      onOpenExistingClient(target);
                      onClose();
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-300 hover:underline"
                >
                  <span>Open {(duplicateClient || liveDuplicate)?.name}&apos;s profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="pt-1 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[48px] rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold active:scale-[0.98] transition-all"
            >
              {submitting ? 'Saving...' : existingClient ? 'Save Changes' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
