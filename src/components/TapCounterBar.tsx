import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  RotateCcw,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { Client } from '../types';
import { formatCurrency, formatNumber, roundCurrency, splitAmountEvenly } from '../lib/currency';
import { triggerHaptic, useDeniBook } from '../lib/store';

interface TapCounterBarProps {
  selectedClients: Client[];
  onClearSelection: () => void;
}

interface LimitWarningItem {
  client: Client;
  projectedBalance: number;
  creditLimit: number;
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
  const [showAdjustments, setShowAdjustments] = useState<boolean>(false);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [depositInput, setDepositInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [limitWarnings, setLimitWarnings] = useState<LimitWarningItem[]>([]);

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

  const grossTotal = isCustomMode
    ? Math.max(0, Number(customAmount) || 0)
    : roundCurrency(quantity * (activeProduct?.unit_price || 0));

  const discountVal = roundCurrency(Math.min(grossTotal, Math.max(0, Number(discountInput) || 0)));
  const netAfterDiscount = roundCurrency(Math.max(0, grossTotal - discountVal));
  const depositVal = roundCurrency(
    Math.min(netAfterDiscount, Math.max(0, Number(depositInput) || 0))
  );
  const remainingDebt = roundCurrency(Math.max(0, netAfterDiscount - depositVal));

  const splitCount = selectedClients.length;
  const remainingShares = splitAmountEvenly(remainingDebt, splitCount);
  const uniqueRemainingShares = Array.from(new Set(remainingShares));

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
    setDiscountInput('');
    setDepositInput('');
  };

  const executeSave = async () => {
    if (isSaving || netAfterDiscount <= 0) return;
    setIsSaving(true);
    try {
      const ok = await saveDebtSale({
        clientIds: selectedClients.map((c) => c.id),
        productName: isCustomMode ? customLabel.trim() || 'Custom' : activeProduct?.name || 'Item',
        quantity: isCustomMode ? 1 : quantity,
        totalAmount: grossTotal,
        discountAmount: discountVal,
        depositAmount: depositVal,
      });
      if (ok) {
        setQuantity(1);
        setCustomAmount('');
        setDiscountInput('');
        setDepositInput('');
        setShowAdjustments(false);
        setLimitWarnings([]);
        onClearSelection();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = async () => {
    if (isSaving || netAfterDiscount <= 0) return;

    // Pre-Save Credit Limit Check (Non-Blocking Warning)
    if (remainingDebt > 0) {
      const exceeded: LimitWarningItem[] = [];
      selectedClients.forEach((client, idx) => {
        if (client.credit_limit && client.credit_limit > 0) {
          const incomingShare = remainingShares[idx] ?? 0;
          const projected = roundCurrency(client.total_balance + incomingShare);
          if (projected > client.credit_limit) {
            exceeded.push({
              client,
              projectedBalance: projected,
              creditLimit: client.credit_limit,
            });
          }
        }
      });

      if (exceeded.length > 0) {
        triggerHaptic(22);
        setLimitWarnings(exceeded);
        return;
      }
    }

    await executeSave();
  };

  const hasAdjustments = discountVal > 0 || depositVal > 0;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-2 sm:px-6 pb-2 sm:pb-4 pointer-events-none"
        role="region"
        aria-label="Quick Sale Tap Counter"
      >
        <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#26322E] shadow-2xl p-3.5 sm:p-4">
          {/* Top Row: Selected Clients + Discount/Deposit Toggle + Close */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100 dark:border-[#1E2724]">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                {splitCount > 1
                  ? `Split ${splitCount} ways · ${clientNamesDisplay}`
                  : selectedClients[0].name}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowAdjustments((v) => !v);
                }}
                aria-expanded={showAdjustments}
                className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors whitespace-nowrap ${
                  showAdjustments || hasAdjustments
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>
                  {hasAdjustments
                    ? `Disc ${formatNumber(discountVal)} · Depo ${formatNumber(depositVal)}`
                    : 'Discount / Depo'}
                </span>
                {showAdjustments ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Clear selection"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
                  <span>Tap {activeProduct?.name} (+1)</span>
                </span>
                <span className="font-mono-num text-lg sm:text-xl font-bold">
                  {quantity}x = {formatNumber(grossTotal)}
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

          {/* Expandable Discount & Deposit Inputs */}
          {showAdjustments && (
            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-[#1E2724] grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="cart-discount-input"
                  className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300"
                >
                  Discount Allowed ({settings.currency})
                </label>
                <input
                  id="cart-discount-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={grossTotal || undefined}
                  step="any"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm font-mono-num font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label
                  htmlFor="cart-deposit-input"
                  className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300"
                >
                  Deposit Paid Now ({settings.currency})
                </label>
                <input
                  id="cart-deposit-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={netAfterDiscount || undefined}
                  step="any"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm font-mono-num font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          )}

          {/* Live Split Preview + Save Debt CTA */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 min-w-0">
              {hasAdjustments ? (
                <p className="font-medium truncate">
                  {discountVal > 0 && (
                    <span>
                      Net <strong className="font-mono-num">{formatNumber(netAfterDiscount)}</strong>{' '}
                      (Disc {formatNumber(discountVal)}) ·{' '}
                    </span>
                  )}
                  {depositVal > 0 && (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Depo <strong className="font-mono-num">{formatNumber(depositVal)}</strong> ·{' '}
                    </span>
                  )}
                  Debt:{' '}
                  <strong className="font-mono-num text-stone-900 dark:text-stone-50">
                    {formatCurrency(remainingDebt, settings.currency)}
                  </strong>
                  {splitCount > 1 && remainingDebt > 0 && (
                    <span className="text-teal-700 dark:text-teal-400 font-semibold">
                      {' '}
                      →{' '}
                      {uniqueRemainingShares.length === 1
                        ? `${formatNumber(remainingShares[0])} each`
                        : `${formatNumber(Math.min(...remainingShares))}–${formatNumber(
                            Math.max(...remainingShares)
                          )} each`}
                    </span>
                  )}
                </p>
              ) : splitCount > 1 ? (
                <p className="font-medium truncate">
                  Total:{' '}
                  <strong className="font-mono-num text-stone-900 dark:text-stone-50">
                    {formatCurrency(grossTotal, settings.currency)}
                  </strong>{' '}
                  →{' '}
                  <strong className="font-mono-num text-teal-700 dark:text-teal-400">
                    {uniqueRemainingShares.length === 1
                      ? `${formatNumber(remainingShares[0])} each`
                      : `${formatNumber(Math.min(...remainingShares))}–${formatNumber(
                          Math.max(...remainingShares)
                        )} each`}
                  </strong>{' '}
                  <span className="text-stone-500 dark:text-stone-400">({clientNamesDisplay})</span>
                </p>
              ) : (
                <p className="font-medium truncate">
                  Adding{' '}
                  <strong className="font-mono-num text-stone-900 dark:text-stone-50">
                    {formatCurrency(remainingDebt, settings.currency)}
                  </strong>{' '}
                  to {selectedClients[0].name}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={isSaving || netAfterDiscount <= 0}
              onClick={handleSaveClick}
              className="w-full sm:w-auto min-h-[48px] px-6 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
            >
              <Check className="w-5 h-5" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : remainingDebt === 0 && depositVal > 0
                    ? 'Save Paid Sale'
                    : hasAdjustments
                      ? `Save Debt (${formatNumber(remainingDebt)})`
                      : 'Save Debt'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Save Credit Limit Confirmation Modal */}
      {limitWarnings.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Credit Limit Warning"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 shadow-2xl">
            <div className="w-10 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">
                  Credit Limit Exceeded
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-300">
                  Saving this sale will push the following{' '}
                  {limitWarnings.length === 1 ? 'customer' : 'customers'} past their credit limit:
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {limitWarnings.map((item) => (
                <li
                  key={item.client.id}
                  className="rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 dark:text-stone-100"
                >
                  <span className="font-bold">{item.client.name}</span> will reach{' '}
                  <span className="font-mono-num font-bold text-rose-700 dark:text-rose-400">
                    {settings.currency} {formatNumber(item.projectedBalance)}
                  </span>{' '}
                  /{' '}
                  <span className="font-mono-num font-semibold">
                    {formatNumber(item.creditLimit)}
                  </span>{' '}
                  limit
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setLimitWarnings([])}
                className="min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={executeSave}
                className="flex-1 min-h-[48px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold active:scale-[0.98] transition-all"
              >
                {isSaving ? 'Saving...' : 'Allow & Save Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
