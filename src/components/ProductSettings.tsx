import React, { useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  Download,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Plus,
  RotateCcw,
  Star,
  Sun,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { formatNumber } from '../lib/currency';
import { DEFAULT_WHATSAPP_TEMPLATE } from '../lib/phone';
import { useDeniBook } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';
import { PWAInstallButton } from './PWAInstallButton';

export const ProductSettings: React.FC = () => {
  const { user, profile } = useAuth();
  const {
    products,
    settings,
    isSyncing,
    syncNow,
    upsertProduct,
    deleteProduct,
    setDefaultProduct,
    updateSettings,
    exportCsv,
    resetDemoData,
    clearAllRecords,
    lockApp,
    logoutAndClear,
    pushToast,
  } = useDeniBook();

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const [pinDraft, setPinDraft] = useState(settings.pinCode);
  const [shopNameDraft, setShopNameDraft] = useState(profile?.shop_name || settings.shopName);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);

  useEffect(() => {
    if (profile?.shop_name) {
      setShopNameDraft(profile.shop_name);
    }
  }, [profile?.shop_name]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(newPrice);
    if (!newName.trim() || Number.isNaN(price) || price < 0) {
      pushToast('Enter a valid item name and price', 'error');
      return;
    }
    const ok = await upsertProduct({
      name: newName.trim(),
      unit_price: price,
      is_default: products.length === 0,
    });
    if (ok) {
      setNewName('');
      setNewPrice('');
    }
  };

  const handleSaveEdit = async (id: string, isDefault: boolean) => {
    const price = Number(editPrice);
    if (!editName.trim() || Number.isNaN(price) || price < 0) return;
    const ok = await upsertProduct({
      id,
      name: editName.trim(),
      unit_price: price,
      is_default: isDefault,
    });
    if (ok) setEditingId(null);
  };

  const handleSavePin = () => {
    if (!/^\d{4}$/.test(pinDraft)) {
      pushToast('PIN must be exactly 4 digits', 'error');
      return;
    }
    void updateSettings({ pinCode: pinDraft });
    pushToast('Owner PIN updated');
  };

  const handleSaveShopName = async () => {
    if (!shopNameDraft.trim()) {
      pushToast('Shop name cannot be empty', 'error');
      return;
    }
    await updateSettings({ shopName: shopNameDraft.trim() });
    pushToast('Shop name updated');
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">
            Catalog &amp; Settings
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Manage item prices, WhatsApp reminder script, PIN lock, and ledger backups.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="min-h-[44px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Product & Price Catalog */}
        <section className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
              Items &amp; Prices
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Tap the star to choose the default item for the Quick-Sale counter.
            </p>
          </div>

          <ul className="divide-y divide-stone-100 dark:divide-[#1E2724]">
            {products.map((product) => {
              const isEditing = editingId === product.id;

              return (
                <li key={product.id} className="py-3 flex items-center justify-between gap-2">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Item name"
                        className="flex-1 min-h-[42px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm text-stone-900 dark:text-stone-100"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        aria-label="Unit price"
                        className="w-24 min-h-[42px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm font-mono-num text-stone-900 dark:text-stone-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(product.id, product.is_default)}
                        aria-label="Save item"
                        className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-teal-700 text-white"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => setDefaultProduct(product.id)}
                          aria-label={`Set ${product.name} as default`}
                          title={product.is_default ? 'Default item' : 'Set as default'}
                          className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
                            product.is_default
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                              : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                          }`}
                        >
                          <Star
                            className="w-4 h-4"
                            fill={product.is_default ? 'currentColor' : 'none'}
                          />
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-stone-500 dark:text-stone-400 font-mono-num">
                            {settings.currency} {formatNumber(product.unit_price)}
                            {product.is_default ? ' · Default' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(product.id);
                            setEditName(product.name);
                            setEditPrice(String(product.unit_price));
                          }}
                          className="min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          Edit
                        </button>
                        {products.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteProduct(product.id)}
                            aria-label={`Delete ${product.name}`}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <form onSubmit={handleAddProduct} className="pt-2 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New item (e.g. Sugar 1kg)"
              className="flex-1 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3.5 text-sm text-stone-900 dark:text-stone-100"
            />
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Price"
                className="w-28 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm font-mono-num text-stone-900 dark:text-stone-100"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </form>
        </section>

        {/* 2. Shop, Theme & WhatsApp Template */}
        <section className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
            Shop &amp; WhatsApp Preferences
          </h2>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label
                htmlFor="shop-name-input"
                className="block text-xs font-semibold text-stone-600 dark:text-stone-300"
              >
                Shop / Business Name
              </label>
              <input
                id="shop-name-input"
                type="text"
                value={shopNameDraft}
                onChange={(e) => setShopNameDraft(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveShopName}
              className="min-h-[44px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 text-sm font-semibold whitespace-nowrap shrink-0"
            >
              Save
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="currency-input"
                className="block text-xs font-semibold text-stone-600 dark:text-stone-300"
              >
                Currency Code
              </label>
              <input
                id="currency-input"
                type="text"
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value.toUpperCase().slice(0, 5) })}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm font-mono-num text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="country-code-input"
                className="block text-xs font-semibold text-stone-600 dark:text-stone-300"
              >
                Country Code (+)
              </label>
              <input
                id="country-code-input"
                type="text"
                inputMode="numeric"
                value={settings.countryCode}
                onChange={(e) =>
                  updateSettings({ countryCode: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
                className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-sm font-mono-num text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          {/* Theme Switch */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Display Theme
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                High-contrast light for outdoor sun, dark for low glare
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'light' })}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  settings.theme === 'light'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  settings.theme === 'dark'
                    ? 'bg-stone-800 text-stone-50 shadow-xs'
                    : 'text-stone-500'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* WhatsApp Reminder Template */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="wa-template"
                className="text-xs font-semibold text-stone-600 dark:text-stone-300"
              >
                WhatsApp Reminder Template
              </label>
              <button
                type="button"
                onClick={() => updateSettings({ whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE })}
                className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
              >
                Reset default
              </button>
            </div>
            <textarea
              id="wa-template"
              rows={3}
              value={settings.whatsappTemplate}
              onChange={(e) => updateSettings({ whatsappTemplate: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['{name}', '{currency}', '{balance}', '{date}', '{items}'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() =>
                    updateSettings({
                      whatsappTemplate: `${settings.whatsappTemplate} ${token}`,
                    })
                  }
                  className="min-h-[32px] px-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs font-mono-num text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                >
                  +{token}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Owner PIN Lock & Security */}
        <section className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
                  Owner PIN Lock
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Protect customer records with a 4-digit passcode
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={lockApp}
              className="min-h-[40px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Now</span>
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
            <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
              Require PIN on app launch
            </span>
            <input
              type="checkbox"
              checked={settings.pinEnabled}
              onChange={(e) => updateSettings({ pinEnabled: e.target.checked })}
              className="w-5 h-5 accent-teal-700 rounded"
            />
          </label>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label
                htmlFor="pin-code-input"
                className="block text-xs font-semibold text-stone-600 dark:text-stone-300"
              >
                4-Digit PIN (Current: {settings.pinCode})
              </label>
              <input
                id="pin-code-input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 text-base font-mono-num tracking-widest text-stone-900 dark:text-stone-100"
              />
            </div>
            <button
              type="button"
              onClick={handleSavePin}
              className="min-h-[44px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 text-sm font-semibold whitespace-nowrap shrink-0"
            >
              Save PIN
            </button>
          </div>
        </section>

        {/* 4. Account, Cloud Sync & App Backup */}
        <section className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
                Account &amp; Cloud Sync
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                Signed in as {user?.email || 'Owner'} ·{' '}
                {isSupabaseConfigured ? 'Supabase Cloud Sync active' : 'Local Multi-Tenant Storage'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSupabaseConfigured && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={syncNow}
                className="min-h-[44px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {isSyncing ? 'Syncing...' : 'Sync DB Now'}
              </button>
            )}
            <button
              type="button"
              onClick={logoutAndClear}
              className="min-h-[44px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200 flex items-center gap-2 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out / Switch Account</span>
            </button>
          </div>

          <PWAInstallButton variant="full" />

          <div className="pt-2 border-t border-stone-100 dark:border-[#1E2724] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction('reset')}
              className="min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Sample Data</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmAction('clear')}
              className="min-h-[44px] px-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Start Blank (Clear All)</span>
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              {confirmAction === 'reset' ? 'Restore starter sample data?' : 'Clear all client records?'}
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-300">
              {confirmAction === 'reset'
                ? 'This replaces current local records with the sample customers and transactions.'
                : 'This deletes all local customers and transactions so you can start your real shop book fresh. Product catalog is kept.'}
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'reset') resetDemoData();
                  else clearAllRecords();
                  setConfirmAction(null);
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-rose-600 text-white text-sm font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
