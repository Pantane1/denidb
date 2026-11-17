import React, { useState } from 'react';
import { Banknote, Check, Delete, Smartphone, X } from 'lucide-react';
import { Client, PaymentMethod } from '../types';
import { formatCurrency, formatNumber, roundCurrency } from '../lib/currency';
import { triggerHaptic, useDeniBook } from '../lib/store';

interface PaymentModalProps {
  client: Client;
  onClose: () => void;
}

const DENOMINATIONS = [50, 100, 200, 500];

export const PaymentModal: React.FC<PaymentModalProps> = ({ client, onClose }) => {
  const { settings, recordPayment } = useDeniBook();
  const [amountInput, setAmountInput] = useState<string>(
    client.total_balance > 0 ? String(roundCurrency(client.total_balance)) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const numericAmount = Math.max(0, Number(amountInput) || 0);

  const handleDigit = (digit: string) => {
    triggerHaptic(8);
    setAmountInput((prev) => {
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev === '0' && digit !== '.') return digit;
      if (prev.length >= 9) return prev;
      return `${prev}${digit}`;
    });
  };

  const handleBackspace = () => {
    triggerHaptic(8);
    setAmountInput((prev) => prev.slice(0, -1));
  };

  const handleSave = async () => {
    if (isSaving || numericAmount <= 0) return;
    setIsSaving(true);
    try {
      const ok = await recordPayment({
        clientId: client.id,
        amount: numericAmount,
        note,
        paymentMethod,
      });
      if (ok) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const halfBalance = roundCurrency(client.total_balance / 2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Record payment for ${client.name}`}
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
              Record Payment (Lipia)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {client.name} · Current balance:{' '}
              <span className="font-mono-num font-semibold text-stone-800 dark:text-stone-200">
                {formatCurrency(client.total_balance, settings.currency)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payment Method 2-Pill Toggle */}
        <div
          className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
          role="radiogroup"
          aria-label="Payment method"
        >
          <button
            type="button"
            role="radio"
            aria-checked={paymentMethod === 'CASH'}
            onClick={() => {
              triggerHaptic(8);
              setPaymentMethod('CASH');
            }}
            className={`min-h-[42px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              paymentMethod === 'CASH'
                ? 'bg-white dark:bg-[#1E2925] text-stone-900 dark:text-stone-50 shadow-xs border border-stone-200/80 dark:border-stone-700'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Cash</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={paymentMethod === 'MPESA'}
            onClick={() => {
              triggerHaptic(8);
              setPaymentMethod('MPESA');
            }}
            className={`min-h-[42px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              paymentMethod === 'MPESA'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>M-Pesa</span>
          </button>
        </div>

        {/* Amount Display */}
        <div className="mt-3 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3.5">
          <label
            htmlFor="payment-amount-input"
            className="block text-xs font-medium text-stone-500 dark:text-stone-400"
          >
            Payment Amount ({settings.currency})
          </label>
          <input
            id="payment-amount-input"
            type="number"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="0"
            className="mt-1 w-full bg-transparent font-mono-num text-3xl font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none"
          />
        </div>

        {/* Quick-Fill Preset Chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {client.total_balance > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setAmountInput(String(roundCurrency(client.total_balance)));
                }}
                className="min-h-[40px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              >
                Full Balance ({formatNumber(client.total_balance)})
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setAmountInput(String(halfBalance));
                }}
                className="min-h-[40px] px-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700"
              >
                Half ({formatNumber(halfBalance)})
              </button>
            </>
          )}

          {DENOMINATIONS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setAmountInput(String(val));
              }}
              className="min-h-[40px] px-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-mono-num font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700"
            >
              {val}
            </button>
          ))}
        </div>

        {/* Tap-Friendly Numeric Keypad */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleDigit(key)}
              className="min-h-[48px] rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 font-mono-num text-lg font-bold text-stone-900 dark:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 active:scale-95 transition-all"
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="min-h-[48px] rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 active:scale-95 transition-all"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. M-Pesa, Cash)"
          aria-label="Payment note"
          className="mt-3 w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
        />

        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAmountInput('')}
            className="min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isSaving || numericAmount <= 0}
            onClick={handleSave}
            className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Check className="w-5 h-5" />
            <span>
              {isSaving
                ? 'Saving...'
                : `Save Payment (${formatCurrency(numericAmount, settings.currency)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
