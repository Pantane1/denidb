import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppSettings,
  Client,
  LedgerTransaction,
  Product,
  ToastItem,
  TransactionType,
} from '../types';
import { useAuth } from './auth';
import { isSameLocalDay, roundCurrency, splitAmountEvenly } from './currency';
import { DEFAULT_WHATSAPP_TEMPLATE, sanitizeWhatsAppNumber } from './phone';
import { isSupabaseConfigured, supabase } from './supabase';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const THEME_PREF_KEY = 'denibook_ui_theme_v1';

const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'My Shop',
  currency: 'KES',
  countryCode: '254',
  whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
  theme: 'light',
  pinEnabled: false,
  pinCode: '1234',
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createSampleData(): {
  clients: Client[];
  products: Product[];
  transactions: LedgerTransaction[];
} {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  const products: Product[] = [
    { id: uuid(), name: 'Fert', unit_price: 50, is_default: true },
    { id: uuid(), name: 'Seeds Pack', unit_price: 120, is_default: false },
    { id: uuid(), name: 'Feed 2kg', unit_price: 200, is_default: false },
  ];

  const c1 = uuid();
  const c2 = uuid();
  const c3 = uuid();
  const c4 = uuid();

  const transactions: LedgerTransaction[] = [
    {
      id: uuid(),
      client_id: c1,
      type: TransactionType.DEBT,
      product_name: 'Fert',
      quantity: 3,
      split_count: 1,
      amount: 150,
      created_at: hoursAgo(2),
    },
    {
      id: uuid(),
      client_id: c1,
      type: TransactionType.PAYMENT,
      product_name: 'Payment',
      quantity: 1,
      split_count: 1,
      amount: 50,
      note: 'Cash partial',
      created_at: hoursAgo(1),
    },
    {
      id: uuid(),
      client_id: c2,
      type: TransactionType.DEBT,
      product_name: 'Fert',
      quantity: 4,
      split_count: 2,
      amount: 100,
      note: 'Split 2 ways',
      created_at: hoursAgo(3),
    },
    {
      id: uuid(),
      client_id: c3,
      type: TransactionType.DEBT,
      product_name: 'Fert',
      quantity: 4,
      split_count: 2,
      amount: 100,
      note: 'Split 2 ways',
      created_at: hoursAgo(3),
    },
    {
      id: uuid(),
      client_id: c4,
      type: TransactionType.DEBT,
      product_name: 'Fert',
      quantity: 2,
      split_count: 1,
      amount: 100,
      created_at: hoursAgo(28),
    },
    {
      id: uuid(),
      client_id: c4,
      type: TransactionType.PAYMENT,
      product_name: 'Payment',
      quantity: 1,
      split_count: 1,
      amount: 100,
      note: 'Settled in full',
      created_at: hoursAgo(4),
    },
  ];

  const rawClients: Client[] = [
    {
      id: c1,
      name: 'Wanjiku Kamau',
      whatsapp_number: '254712345678',
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(1),
    },
    {
      id: c2,
      name: 'Brian Ochieng',
      whatsapp_number: '254723456789',
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(3),
    },
    {
      id: c3,
      name: 'Grace Mutua',
      whatsapp_number: '254734567890',
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(3),
    },
    {
      id: c4,
      name: 'Peter Njoroge',
      whatsapp_number: '254745678901',
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(4),
    },
  ];

  return {
    clients: recomputeBalances(rawClients, transactions),
    products,
    transactions,
  };
}

function recomputeBalances(clients: Client[], transactions: LedgerTransaction[]): Client[] {
  const totals = new Map<string, { balance: number; latestAt?: string }>();
  for (const tx of transactions) {
    const prev = totals.get(tx.client_id) || { balance: 0, latestAt: undefined };
    const delta = tx.type === TransactionType.DEBT ? tx.amount : -tx.amount;
    const latestAt =
      !prev.latestAt || new Date(tx.created_at) > new Date(prev.latestAt)
        ? tx.created_at
        : prev.latestAt;
    totals.set(tx.client_id, {
      balance: roundCurrency(prev.balance + delta),
      latestAt,
    });
  }

  return clients.map((c) => {
    const info = totals.get(c.id);
    return {
      ...c,
      total_balance: info ? roundCurrency(Math.max(0, info.balance)) : 0,
      updated_at: info?.latestAt || c.updated_at,
    };
  });
}

export function triggerHaptic(ms = 12): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}

interface DeniBookContextValue {
  clients: Client[];
  products: Product[];
  transactions: LedgerTransaction[];
  settings: AppSettings;
  pendingOpsCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  isInitialLoading: boolean;
  isLocked: boolean;
  toasts: ToastItem[];
  kpis: {
    totalOwed: number;
    addedToday: number;
    collectedToday: number;
  };
  unlockWithPin: (pin: string) => boolean;
  lockApp: () => void;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: string) => void;
  addClient: (name: string, phone: string) => Promise<Client | null>;
  updateClient: (id: string, name: string, phone: string) => Promise<boolean>;
  deleteClient: (id: string) => Promise<boolean>;
  saveDebtSale: (params: {
    clientIds: string[];
    productName: string;
    quantity: number;
    totalAmount: number;
    discountAmount?: number;
    depositAmount?: number;
    note?: string;
  }) => Promise<boolean>;
  recordPayment: (params: {
    clientId: string;
    amount: number;
    note?: string;
  }) => Promise<boolean>;
  voidTransaction: (txId: string) => Promise<boolean>;
  upsertProduct: (product: Omit<Product, 'id'> & { id?: string }) => Promise<boolean>;
  deleteProduct: (productId: string) => Promise<boolean>;
  setDefaultProduct: (productId: string) => Promise<boolean>;
  exportCsv: () => void;
  resetDemoData: () => Promise<void>;
  clearAllRecords: () => Promise<void>;
  syncNow: () => Promise<void>;
  logoutAndClear: () => Promise<void>;
}

const DeniBookContext = createContext<DeniBookContextValue | null>(null);

export const DeniBookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, signOut, updateProfile, refreshProfile } = useAuth();
  const isOnline = useOnlineStatus();

  if (!user) {
    throw new Error('DeniBookProvider requires an authenticated user');
  }

  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedTheme = localStorage.getItem(THEME_PREF_KEY) === 'dark' ? 'dark' : 'light';
    return {
      ...DEFAULT_SETTINGS,
      shopName: profile?.shop_name || DEFAULT_SETTINGS.shopName,
      currency: profile?.currency || DEFAULT_SETTINGS.currency,
      countryCode: profile?.country_code || DEFAULT_SETTINGS.countryCode,
      whatsappTemplate: profile?.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
      theme: savedTheme,
    };
  });

  // Sync settings whenever profile row arrives from Supabase
  useEffect(() => {
    if (!profile) return;
    setSettings((prev) => ({
      ...prev,
      shopName: profile.shop_name || prev.shopName,
      currency: profile.currency || prev.currency,
      countryCode: profile.country_code || prev.countryCode,
      whatsappTemplate: profile.whatsapp_template || prev.whatsappTemplate,
    }));
  }, [profile]);

  // Pure in-memory state hydrated directly from Supabase PostgreSQL
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>(
    isSupabaseConfigured ? [] : [{ id: uuid(), name: 'Fert', unit_price: 50, is_default: true }]
  );
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(isSupabaseConfigured);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const fetchingRef = useRef(false);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_PREF_KEY, settings.theme);
  }, [settings.theme]);

  const pushToast = useCallback((message: string, tone: ToastItem['tone'] = 'success') => {
    const id = uuid();
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchAllFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !user?.id || fetchingRef.current) {
      setIsInitialLoading(false);
      return;
    }

    fetchingRef.current = true;
    setIsSyncing(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) {
        return;
      }
      const uid = authData.user.id;

      const [clientsRes, productsRes, txRes] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .eq('user_id', uid)
          .order('name', { ascending: true }),
        supabase
          .from('products')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: true }),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      if (clientsRes.error) {
        pushToast(`Failed to load clients: ${clientsRes.error.message}`, 'error');
      } else {
        setClients((clientsRes.data as Client[]) || []);
      }

      if (productsRes.error) {
        pushToast(`Failed to load products: ${productsRes.error.message}`, 'error');
      } else if (productsRes.data && productsRes.data.length > 0) {
        setProducts(productsRes.data as Product[]);
      } else {
        // Ensure new account has default "Fert" @ 50 in Supabase
        const { data: seeded, error: seedErr } = await supabase
          .from('products')
          .insert({
            user_id: uid,
            name: 'Fert',
            unit_price: 50,
            is_default: true,
          })
          .select('*');
        if (seedErr) {
          pushToast(`Failed to seed default item: ${seedErr.message}`, 'error');
        } else if (seeded) {
          setProducts(seeded as Product[]);
        }
      }

      if (txRes.error) {
        pushToast(`Failed to load transactions: ${txRes.error.message}`, 'error');
      } else {
        setTransactions((txRes.data as LedgerTransaction[]) || []);
      }

      await refreshProfile();
    } finally {
      fetchingRef.current = false;
      setIsSyncing(false);
      setIsInitialLoading(false);
    }
  }, [pushToast, refreshProfile, user?.id]);

  // Fetch user data on login & page reload tied to user?.id
  useEffect(() => {
    if (isSupabaseConfigured && user?.id) {
      void fetchAllFromSupabase();
    } else {
      setIsInitialLoading(false);
    }
  }, [fetchAllFromSupabase, user?.id]);

  const getAuthenticatedUserId = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (error || !authUser) {
      pushToast(error?.message || 'Session expired. Please sign in again.', 'error');
      return null;
    }
    return authUser.id;
  }, [pushToast]);

  const unlockWithPin = useCallback(
    (pin: string) => {
      if (pin === settings.pinCode) {
        setIsLocked(false);
        triggerHaptic(15);
        return true;
      }
      return false;
    },
    [settings.pinCode]
  );

  const lockApp = useCallback(() => {
    setIsLocked(true);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      const profilePatch: Partial<{
        shop_name: string;
        currency: string;
        country_code: string;
        whatsapp_template: string;
      }> = {};
      if (patch.shopName !== undefined && patch.shopName.trim()) {
        profilePatch.shop_name = patch.shopName.trim();
      }
      if (patch.currency !== undefined && patch.currency.trim()) {
        profilePatch.currency = patch.currency.trim();
      }
      if (patch.countryCode !== undefined && patch.countryCode.trim()) {
        profilePatch.country_code = patch.countryCode.trim();
      }
      if (patch.whatsappTemplate !== undefined) {
        profilePatch.whatsapp_template = patch.whatsappTemplate;
      }
      if (Object.keys(profilePatch).length > 0) {
        const res = await updateProfile(profilePatch);
        if (res.error) {
          pushToast(`Failed to save profile settings: ${res.error}`, 'error');
        }
      }
    },
    [pushToast, updateProfile]
  );

  const addClient = useCallback(
    async (name: string, phone: string): Promise<Client | null> => {
      const cleanName = name.trim();
      const formattedPhone = sanitizeWhatsAppNumber(phone, settings.countryCode);

      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return null;

        const { data, error } = await supabase
          .from('clients')
          .insert({
            user_id: uid,
            name: cleanName,
            whatsapp_number: formattedPhone,
          })
          .select('*')
          .single();

        if (error || !data) {
          pushToast(`Could not add client: ${error?.message || 'Unknown error'}`, 'error');
          return null;
        }

        const created = data as Client;
        setClients((prev) => [created, ...prev]);
        pushToast(`Added ${created.name}`);
        return created;
      }

      const now = new Date().toISOString();
      const created: Client = {
        id: uuid(),
        user_id: user.id,
        name: cleanName,
        whatsapp_number: formattedPhone,
        total_balance: 0,
        created_at: now,
        updated_at: now,
      };
      setClients((prev) => [created, ...prev]);
      pushToast(`Added ${created.name}`);
      return created;
    },
    [getAuthenticatedUserId, pushToast, settings.countryCode, user.id]
  );

  const updateClient = useCallback(
    async (id: string, name: string, phone: string): Promise<boolean> => {
      const cleanName = name.trim();
      const formatted = sanitizeWhatsAppNumber(phone, settings.countryCode);

      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const { data, error } = await supabase
          .from('clients')
          .update({ name: cleanName, whatsapp_number: formatted })
          .eq('id', id)
          .eq('user_id', uid)
          .select('*')
          .single();

        if (error || !data) {
          pushToast(`Could not update client: ${error?.message || 'Unknown error'}`, 'error');
          return false;
        }

        setClients((prev) => prev.map((c) => (c.id === id ? (data as Client) : c)));
        pushToast('Client details updated');
        return true;
      }

      setClients((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                name: cleanName,
                whatsapp_number: formatted,
                updated_at: new Date().toISOString(),
              }
            : c
        )
      );
      pushToast('Client details updated');
      return true;
    },
    [getAuthenticatedUserId, pushToast, settings.countryCode]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<boolean> => {
      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id)
          .eq('user_id', uid);

        if (error) {
          pushToast(`Could not delete client: ${error.message}`, 'error');
          return false;
        }
      }

      setClients((prev) => prev.filter((c) => c.id !== id));
      setTransactions((prev) => prev.filter((t) => t.client_id !== id));
      pushToast('Client removed', 'info');
      return true;
    },
    [getAuthenticatedUserId, pushToast]
  );

  const saveDebtSale = useCallback(
    async ({
      clientIds,
      productName,
      quantity,
      totalAmount,
      discountAmount = 0,
      depositAmount = 0,
      note,
    }: {
      clientIds: string[];
      productName: string;
      quantity: number;
      totalAmount: number;
      discountAmount?: number;
      depositAmount?: number;
      note?: string;
    }): Promise<boolean> => {
      if (clientIds.length === 0 || totalAmount <= 0) return false;

      const discount = roundCurrency(Math.min(totalAmount, Math.max(0, discountAmount)));
      const netSale = roundCurrency(totalAmount - discount);
      if (netSale <= 0) return false;

      const deposit = roundCurrency(Math.min(netSale, Math.max(0, depositAmount)));
      const netDebtAdded = roundCurrency(netSale - deposit);

      const splitCount = clientIds.length;
      const debtShares = splitAmountEvenly(netSale, splitCount);
      const depositShares = deposit > 0 ? splitAmountEvenly(deposit, splitCount) : [];

      const baseMs = Date.now();
      const debtTime = new Date(baseMs).toISOString();
      const depositTime = new Date(baseMs + 10).toISOString();

      const noteParts: string[] = [];
      if (splitCount > 1) noteParts.push(`Split ${splitCount} ways`);
      if (discount > 0) noteParts.push(`Disc ${settings.currency} ${discount}`);
      if (note?.trim()) noteParts.push(note.trim());
      const combinedNote = noteParts.length > 0 ? noteParts.join(' · ') : undefined;

      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const rowsToInsert = [
          ...clientIds.map((clientId, idx) => ({
            user_id: uid,
            client_id: clientId,
            type: TransactionType.DEBT,
            product_name: productName,
            quantity,
            split_count: splitCount,
            amount: debtShares[idx],
            note: combinedNote ?? null,
            created_at: debtTime,
          })),
          ...(deposit > 0
            ? clientIds
                .map((clientId, idx) => ({
                  user_id: uid,
                  client_id: clientId,
                  type: TransactionType.PAYMENT,
                  product_name: 'Deposit',
                  quantity: 1,
                  split_count: splitCount,
                  amount: depositShares[idx],
                  note:
                    splitCount > 1 ? `Deposit at sale (Split ${splitCount} ways)` : 'Deposit at sale',
                  created_at: depositTime,
                }))
                .filter((r) => r.amount > 0)
            : []),
        ];

        const { data: insertedTxs, error: insertError } = await supabase
          .from('transactions')
          .insert(rowsToInsert)
          .select('*');

        if (insertError) {
          pushToast(`Failed to save sale: ${insertError.message}`, 'error');
          return false;
        }

        // Refresh updated client balances computed by DB trigger
        const { data: refreshedClients } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', uid)
          .order('name', { ascending: true });

        if (insertedTxs) {
          setTransactions((prev) => [
            ...(insertedTxs as LedgerTransaction[]).reverse(),
            ...prev,
          ]);
        }
        if (refreshedClients) {
          setClients(refreshedClients as Client[]);
        }
      } else {
        const debtTransactions: LedgerTransaction[] = clientIds.map((clientId, idx) => ({
          id: uuid(),
          user_id: user.id,
          client_id: clientId,
          type: TransactionType.DEBT,
          product_name: productName,
          quantity,
          split_count: splitCount,
          amount: debtShares[idx],
          note: combinedNote,
          created_at: debtTime,
        }));

        const depositTransactions: LedgerTransaction[] =
          deposit > 0
            ? clientIds
                .map((clientId, idx) => ({
                  id: uuid(),
                  user_id: user.id,
                  client_id: clientId,
                  type: TransactionType.PAYMENT,
                  product_name: 'Deposit',
                  quantity: 1,
                  split_count: splitCount,
                  amount: depositShares[idx],
                  note:
                    splitCount > 1 ? `Deposit at sale (Split ${splitCount} ways)` : 'Deposit at sale',
                  created_at: depositTime,
                }))
                .filter((t) => t.amount > 0)
            : [];

        const allNew = [...depositTransactions, ...debtTransactions];
        setTransactions((prevTx) => {
          const nextTx = [...allNew, ...prevTx];
          setClients((prevClients) => recomputeBalances(prevClients, nextTx));
          return nextTx;
        });
      }

      triggerHaptic(18);
      const names = clients
        .filter((c) => clientIds.includes(c.id))
        .map((c) => c.name.split(' ')[0]);
      const nameSummary =
        names.length <= 2
          ? names.join(' & ')
          : `${names[0]} & ${names.length - 1} others`;

      const perClientNetDebt = roundCurrency(netDebtAdded / splitCount);
      if (deposit > 0 || discount > 0) {
        pushToast(
          splitCount > 1
            ? `Saved ${settings.currency} ${perClientNetDebt} debt each (${
                deposit > 0 ? `Depo ${deposit}` : ''
              }${deposit > 0 && discount > 0 ? ', ' : ''}${
                discount > 0 ? `Disc ${discount}` : ''
              }) to ${nameSummary}`
            : `Saved ${settings.currency} ${netDebtAdded} debt to ${nameSummary}`
        );
      } else {
        pushToast(
          splitCount > 1
            ? `Saved ${settings.currency} ${debtShares[0]} each to ${nameSummary}`
            : `Saved ${settings.currency} ${netSale} to ${nameSummary}`
        );
      }
      return true;
    },
    [clients, getAuthenticatedUserId, pushToast, settings.currency, user.id]
  );

  const recordPayment = useCallback(
    async ({
      clientId,
      amount,
      note,
    }: {
      clientId: string;
      amount: number;
      note?: string;
    }): Promise<boolean> => {
      if (amount <= 0) return false;
      const cleanAmount = roundCurrency(amount);
      const now = new Date().toISOString();

      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const { data, error } = await supabase
          .from('transactions')
          .insert({
            user_id: uid,
            client_id: clientId,
            type: TransactionType.PAYMENT,
            product_name: 'Payment',
            quantity: 1,
            split_count: 1,
            amount: cleanAmount,
            note: note?.trim() || null,
            created_at: now,
          })
          .select('*')
          .single();

        if (error || !data) {
          pushToast(`Could not save payment: ${error?.message || 'Unknown error'}`, 'error');
          return false;
        }

        const { data: updatedClient } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .eq('user_id', uid)
          .single();

        setTransactions((prev) => [data as LedgerTransaction, ...prev]);
        if (updatedClient) {
          setClients((prev) =>
            prev.map((c) => (c.id === clientId ? (updatedClient as Client) : c))
          );
        }
      } else {
        const paymentTx: LedgerTransaction = {
          id: uuid(),
          user_id: user.id,
          client_id: clientId,
          type: TransactionType.PAYMENT,
          product_name: 'Payment',
          quantity: 1,
          split_count: 1,
          amount: cleanAmount,
          note: note?.trim() || undefined,
          created_at: now,
        };
        setTransactions((prevTx) => {
          const nextTx = [paymentTx, ...prevTx];
          setClients((prevClients) => recomputeBalances(prevClients, nextTx));
          return nextTx;
        });
      }

      triggerHaptic(16);
      const clientName = clients.find((c) => c.id === clientId)?.name || 'Client';
      pushToast(`Recorded ${settings.currency} ${cleanAmount} from ${clientName}`);
      return true;
    },
    [clients, getAuthenticatedUserId, pushToast, settings.currency, user.id]
  );

  const voidTransaction = useCallback(
    async (txId: string): Promise<boolean> => {
      const targetTx = transactions.find((t) => t.id === txId);

      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', txId)
          .eq('user_id', uid);

        if (error) {
          pushToast(`Could not void entry: ${error.message}`, 'error');
          return false;
        }

        setTransactions((prev) => prev.filter((t) => t.id !== txId));
        if (targetTx) {
          const { data: updatedClient } = await supabase
            .from('clients')
            .select('*')
            .eq('id', targetTx.client_id)
            .eq('user_id', uid)
            .single();
          if (updatedClient) {
            setClients((prev) =>
              prev.map((c) => (c.id === targetTx.client_id ? (updatedClient as Client) : c))
            );
          }
        }
      } else {
        setTransactions((prevTx) => {
          const nextTx = prevTx.filter((t) => t.id !== txId);
          setClients((prevClients) => recomputeBalances(prevClients, nextTx));
          return nextTx;
        });
      }

      triggerHaptic(12);
      pushToast('Entry voided & balance recalculated', 'info');
      return true;
    },
    [getAuthenticatedUserId, pushToast, transactions]
  );

  const upsertProduct = useCallback(
    async (product: Omit<Product, 'id'> & { id?: string }): Promise<boolean> => {
      const cleanName = product.name.trim();
      const cleanPrice = roundCurrency(product.unit_price);

      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        if (product.is_default) {
          await supabase
            .from('products')
            .update({ is_default: false })
            .eq('user_id', uid);
        }

        if (product.id) {
          const { data, error } = await supabase
            .from('products')
            .update({
              name: cleanName,
              unit_price: cleanPrice,
              is_default: product.is_default,
            })
            .eq('id', product.id)
            .eq('user_id', uid)
            .select('*')
            .single();

          if (error || !data) {
            pushToast(`Could not update item: ${error?.message || 'Unknown error'}`, 'error');
            return false;
          }

          setProducts((prev) =>
            prev.map((p) => {
              if (p.id === product.id) return data as Product;
              return product.is_default ? { ...p, is_default: false } : p;
            })
          );
        } else {
          const { data, error } = await supabase
            .from('products')
            .insert({
              user_id: uid,
              name: cleanName,
              unit_price: cleanPrice,
              is_default: product.is_default,
            })
            .select('*')
            .single();

          if (error || !data) {
            pushToast(`Could not add item: ${error?.message || 'Unknown error'}`, 'error');
            return false;
          }

          setProducts((prev) => {
            const base = product.is_default ? prev.map((p) => ({ ...p, is_default: false })) : prev;
            return [...base, data as Product];
          });
        }

        pushToast(`Saved item "${cleanName}"`);
        return true;
      }

      const targetId = product.id || uuid();
      const clean: Product = {
        id: targetId,
        user_id: user.id,
        name: cleanName,
        unit_price: cleanPrice,
        is_default: product.is_default,
      };
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === targetId);
        const mapped = exists
          ? prev.map((p) => (p.id === targetId ? clean : p))
          : [...prev, clean];
        if (clean.is_default) {
          return mapped.map((p) => ({ ...p, is_default: p.id === clean.id }));
        }
        return mapped;
      });
      pushToast(`Saved item "${clean.name}"`);
      return true;
    },
    [getAuthenticatedUserId, pushToast, user.id]
  );

  const deleteProduct = useCallback(
    async (productId: string): Promise<boolean> => {
      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId)
          .eq('user_id', uid);

        if (error) {
          pushToast(`Could not delete item: ${error.message}`, 'error');
          return false;
        }
      }

      setProducts((prev) => {
        const filtered = prev.filter((p) => p.id !== productId);
        if (filtered.length > 0 && !filtered.some((p) => p.is_default)) {
          filtered[0] = { ...filtered[0], is_default: true };
        }
        return filtered;
      });
      pushToast('Item removed', 'info');
      return true;
    },
    [getAuthenticatedUserId, pushToast]
  );

  const setDefaultProduct = useCallback(
    async (productId: string): Promise<boolean> => {
      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const { error: resetErr } = await supabase
          .from('products')
          .update({ is_default: false })
          .eq('user_id', uid);
        if (resetErr) {
          pushToast(`Could not update default item: ${resetErr.message}`, 'error');
          return false;
        }

        const { error: setErr } = await supabase
          .from('products')
          .update({ is_default: true })
          .eq('id', productId)
          .eq('user_id', uid);
        if (setErr) {
          pushToast(`Could not update default item: ${setErr.message}`, 'error');
          return false;
        }
      }

      setProducts((prev) => prev.map((p) => ({ ...p, is_default: p.id === productId })));
      return true;
    },
    [getAuthenticatedUserId, pushToast]
  );

  const kpis = useMemo(() => {
    const today = new Date();
    const totalOwed = roundCurrency(
      clients.reduce((sum, c) => sum + Math.max(0, c.total_balance), 0)
    );
    let addedToday = 0;
    let collectedToday = 0;
    for (const tx of transactions) {
      if (isSameLocalDay(tx.created_at, today)) {
        if (tx.type === TransactionType.DEBT) {
          addedToday += tx.amount;
        } else {
          collectedToday += tx.amount;
        }
      }
    }
    return {
      totalOwed,
      addedToday: roundCurrency(addedToday),
      collectedToday: roundCurrency(collectedToday),
    };
  }, [clients, transactions]);

  const exportCsv = useCallback(() => {
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const headers = [
      'Transaction ID',
      'Date',
      'Client Name',
      'WhatsApp Number',
      'Type',
      'Item',
      'Quantity',
      'Split Ways',
      'Amount',
      'Note',
      'Client Current Balance',
    ];

    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = transactions.map((tx) => {
      const c = clientMap.get(tx.client_id);
      return [
        tx.id,
        tx.created_at,
        c?.name || 'Unknown',
        c?.whatsapp_number || '',
        tx.type,
        tx.product_name,
        tx.quantity,
        tx.split_count,
        tx.type === TransactionType.DEBT ? tx.amount : -tx.amount,
        tx.note || '',
        c?.total_balance ?? 0,
      ]
        .map(esc)
        .join(',');
    });

    const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `denibook-${settings.shopName.toLowerCase().replace(/\s+/g, '-')}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast('Downloaded CSV ledger backup');
  }, [clients, pushToast, settings.shopName, transactions]);

  const resetDemoData = useCallback(async () => {
    const starter = createSampleData();
    if (isSupabaseConfigured && supabase) {
      const uid = await getAuthenticatedUserId();
      if (!uid) return;

      const { error: clientErr } = await supabase.from('clients').insert(
        starter.clients.map((c) => ({
          id: c.id,
          user_id: uid,
          name: c.name,
          whatsapp_number: c.whatsapp_number,
          created_at: c.created_at,
        }))
      );
      if (clientErr) {
        pushToast(`Failed to insert sample clients: ${clientErr.message}`, 'error');
        return;
      }

      const { error: txErr } = await supabase.from('transactions').insert(
        starter.transactions.map((t) => ({
          id: t.id,
          user_id: uid,
          client_id: t.client_id,
          type: t.type,
          product_name: t.product_name,
          quantity: t.quantity,
          split_count: t.split_count,
          amount: t.amount,
          note: t.note ?? null,
          created_at: t.created_at,
        }))
      );
      if (txErr) {
        pushToast(`Failed to insert sample transactions: ${txErr.message}`, 'error');
        return;
      }

      await fetchAllFromSupabase();
      pushToast('Added sample shop data to your database', 'info');
      return;
    }

    setClients(starter.clients);
    setProducts(starter.products);
    setTransactions(starter.transactions);
    pushToast('Loaded sample shop data', 'info');
  }, [fetchAllFromSupabase, getAuthenticatedUserId, pushToast]);

  const clearAllRecords = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      const uid = await getAuthenticatedUserId();
      if (!uid) return;

      const { error } = await supabase.from('clients').delete().eq('user_id', uid);
      if (error) {
        pushToast(`Failed to clear records: ${error.message}`, 'error');
        return;
      }
    }

    setClients([]);
    setTransactions([]);
    pushToast('Cleared all clients and ledger entries', 'info');
  }, [getAuthenticatedUserId, pushToast]);

  const logoutAndClear = useCallback(async () => {
    // ONLY clear in-memory React state — NEVER delete database records on logout
    setClients([]);
    setTransactions([]);
    setProducts([]);
    await signOut();
  }, [signOut]);

  return (
    <DeniBookContext.Provider
      value={{
        clients,
        products,
        transactions,
        settings,
        pendingOpsCount: 0,
        isOnline,
        isSyncing,
        isInitialLoading,
        isLocked,
        toasts,
        kpis,
        unlockWithPin,
        lockApp,
        updateSettings,
        pushToast,
        dismissToast,
        addClient,
        updateClient,
        deleteClient,
        saveDebtSale,
        recordPayment,
        voidTransaction,
        upsertProduct,
        deleteProduct,
        setDefaultProduct,
        exportCsv,
        resetDemoData,
        clearAllRecords,
        syncNow: fetchAllFromSupabase,
        logoutAndClear,
      }}
    >
      {children}
    </DeniBookContext.Provider>
  );
};

export function useDeniBook() {
  const ctx = useContext(DeniBookContext);
  if (!ctx) throw new Error('useDeniBook must be used inside DeniBookProvider');
  return ctx;
}
