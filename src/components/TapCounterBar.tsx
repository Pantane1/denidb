import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, RotateCcw, Users, X } from 'lucide-react';
import { Client } from '../types';
import { formatCurrency, formatNumber, splitAmountEvenly } from '../lib/currency';
import { triggerHaptic, useDeniBook } from '../lib/store';

interface TapCounterBarProps {
  selectedClients: Client[];
  onClearSelection: () => void;
}

export const TapCounterBar: React.FC<TapCounterBarProps> = ({
  selectedClients,
  onClearSelection,
}) => {
  const { products, settings, saveDebtSale } = useDeniBook();
  const defaultProduct = useMemo(
    () => products.find((p) => p.is_default) || products[0],
    [products]
  );

  const [selectedProductId, setSelectedProductId] = useState<string>(
    () => defaultProduct?.id || 'custom'
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customLabel, setCustomLabel] = useState<string>('Custom Item');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Keep selected product valid if catalog changes
  useEffect(() => {
    if (
      selectedProductId !== 'custom' &&
      !products.some((p) => p.id === selectedProductId) &&
      defaultProduct
    ) {
      setSelectedProductId(defaultProduct.id);
    }
  }, [defaultProduct, products, selectedProductId]);

  if (selectedClients.length === 0) return null;

  const isCustomMode = selectedProductId === 'custom';
  const activeProduct = products.find((p) => p.id === selectedProductId) || defaultProduct;

  const totalAmount = isCustomMode
    ? Math.max(0, Number(customAmount) || 0)
    : quantity * (activeProduct?.unit_price || 0);

  const splitCount = selectedClients.length;
  const shares = splitAmountEvenly(totalAmount, splitCount);
  const uniqueShares = Array.from(new Set(shares));

  const clientNamesDisplay =
    selectedClients.length <= 2
      ? selectedClients.map((c) => c.name.split(' ')[0]).join(' & ')
      : `${selectedClients[0].name.split(' ')[0]}, ${selectedClients[1].name.split(' ')[0]} +${
          selectedClients.length - 2
        }`;

  const handleTapIncrement = () => {
    triggerHaptic(10);
    setQuantity((q) => q + 1);
  };

  const handleDecrement = () => {
    triggerHaptic(8);
    setQuantity((q) => Math.max(0, q - 1));
  };

  const handleReset = () => {
    triggerHaptic(8);
    if (isCustomMode) {
      setCustomAmount('');
    } else {
      setQuantity(1);
    }
  };

  const handleSave = async () => {
    if (isSaving || totalAmount <= 0) return;
    setIsSaving(true);
    try {
      await saveDebtSale({
        clientIds: selectedClients.map((c) => c.id),
        productName: isCustomMode ? customLabel.trim() || 'Custom' : activeProduct?.name || 'Item',
        quantity: isCustomMode ? 1 : quantity,
        totalAmount,
      });
      setQuantity(1);
      setCustomAmount('');
      onClearSelection();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-2 sm:px-6 pb-2 sm:pb-4 pointer-events-none"
      role="region"
      aria-label="Quick Sale Tap Counter"
    >
      <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#26322E] shadow-2xl p-3.5 sm:p-4">
        {/* Top Row: Selected Clients + Split Badge + Close */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100 dark:border-[#1E2724]">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
              {splitCount > 1
                ? `Split ${splitCount} ways · ${clientNamesDisplay}`
                : selectedClients[0].name}
            </span>
          </div>

          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Clear selection"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Switcher */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
          {products.map((p) => {
            const active = selectedProductId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setSelectedProductId(p.id);
                  if (quantity === 0) setQuantity(1);
                }}
                className={`min-h-[40px] px-3 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                  active
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                {p.name} · {formatNumber(p.unit_price)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setSelectedProductId('custom');
            }}
            className={`min-h-[40px] px-3 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 border transition-colors ${
              isCustomMode
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            Custom Amount
          </button>
        </div>

        {/* Main Tap Controls */}
        {isCustomMode ? (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Item description"
              aria-label="Custom item name"
              className="min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 text-sm font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              autoFocus
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`Amount (${settings.currency})`}
              aria-label="Custom amount"
              className="min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 text-base font-mono-num font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={quantity <= 0}
              aria-label="Decrease quantity by 1"
              className="min-h-[52px] min-w-[52px] flex items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 active:scale-95 transition-all shrink-0"
            >
              <Minus className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleTapIncrement}
              className="flex-1 min-h-[52px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 font-semibold flex items-center justify-between gap-3 hover:bg-stone-800 dark:hover:bg-white active:scale-[0.98] transition-all"
            >
              <span className="flex items-center gap-2 text-sm sm:text-base">
                <Plus className="w-5 h-5" />
                <span>
                  Tap {activeProduct?.name} (+1)
                </span>
              </span>
              <span className="font-mono-num text-lg sm:text-xl font-bold">
                {quantity}x = {formatNumber(totalAmount)}
              </span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset count to 1"
              title="Reset count"
              className="min-h-[52px] min-w-[52px] flex items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Live Split Preview + Save Debt CTA */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 min-w-0">
            {splitCount > 1 ? (
              <p className="font-medium truncate">
                Total:{' '}
                <strong className="font-mono-num text-stone-900 dark:text-stone-50">
                  {formatCurrency(totalAmount, settings.currency)}
                </strong>{' '}
                →{' '}
                <strong className="font-mono-num text-teal-700 dark:text-teal-400">
                  {uniqueShares.length === 1
                    ? `${formatNumber(shares[0])} each`
                    : `${formatNumber(Math.min(...shares))}–${formatNumber(Math.max(...shares))} each`}
                </strong>{' '}
                <span className="text-stone-500 dark:text-stone-400">({clientNamesDisplay})</span>
              </p>
            ) : (
              <p className="font-medium truncate">
                Adding{' '}
                <strong className="font-mono-num text-stone-900 dark:text-stone-50">
                  {formatCurrency(totalAmount, settings.currency)}
                </strong>{' '}
                to {selectedClients[0].name}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={isSaving || totalAmount <= 0}
            onClick={handleSave}
            className="w-full sm:w-auto min-h-[48px] px-6 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
          >
            <Check className="w-5 h-5" />
            <span>{isSaving ? 'Saving...' : 'Save Debt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
