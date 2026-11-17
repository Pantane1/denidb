import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppSettings,
  Client,
  LedgerTransaction,
  OfflineQueueOp,
  PaymentMethod,
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

function offlineQueueKey(userId: string): string {
  return `denibook_offline_queue_${userId}`;
}

function readOfflineQueue(userId: string): OfflineQueueOp[] {
  try {
    const raw = localStorage.getItem(offlineQueueKey(userId));
    return raw ? (JSON.parse(raw) as OfflineQueueOp[]) : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(userId: string, queue: OfflineQueueOp[]): void {
  try {
    localStorage.setItem(offlineQueueKey(userId), JSON.stringify(queue));
  } catch {
    // ignore storage quota issues
  }
}

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

function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : '';
  return /failed to fetch|networkerror|network request failed|load failed|fetch|timeout|offline/i.test(
    msg
  );
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
      payment_method: 'CASH',
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
      payment_method: 'MPESA',
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
      credit_limit: 500,
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(1),
    },
    {
      id: c2,
      name: 'Brian Ochieng',
      whatsapp_number: '254723456789',
      credit_limit: 1000,
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(3),
    },
    {
      id: c3,
      name: 'Grace Mutua',
      whatsapp_number: '254734567890',
      credit_limit: null,
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(3),
    },
    {
      id: c4,
      name: 'Peter Njoroge',
      whatsapp_number: '254745678901',
      credit_limit: 500,
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

function applyOfflineQueueOptimistically(
  baseClients: Client[],
  baseTransactions: LedgerTransaction[],
  queue: OfflineQueueOp[]
): { clients: Client[]; transactions: LedgerTransaction[] } {
  if (queue.length === 0) {
    return { clients: baseClients, transactions: baseTransactions };
  }

  let nextClients = [...baseClients];
  let nextTransactions = [...baseTransactions];
  const existingTxIds = new Set(nextTransactions.map((t) => t.client_tx_id || t.id));

  for (const op of queue) {
    if (op.kind === 'CREATE_CLIENT') {
      if (!nextClients.some((c) => c.id === op.payload.id)) {
        nextClients = [op.payload, ...nextClients];
      }
    } else if (op.kind === 'UPDATE_CLIENT') {
      nextClients = nextClients.map((c) =>
        c.id === op.payload.id
          ? {
              ...c,
              name: op.payload.name,
              whatsapp_number: op.payload.whatsapp_number,
              credit_limit: op.payload.credit_limit,
              updated_at: op.payload.updated_at,
            }
          : c
      );
    } else if (op.kind === 'ADD_TRANSACTIONS') {
      const fresh = op.payload.filter((t) => !existingTxIds.has(t.client_tx_id || t.id));
      for (const t of fresh) {
        existingTxIds.add(t.client_tx_id || t.id);
      }
      if (fresh.length > 0) {
        nextTransactions = [...fresh.map((t) => ({ ...t, pending_sync: true })), ...nextTransactions];
        const deltas = new Map<string, { delta: number; latestAt?: string }>();
        for (const t of fresh) {
          const prev = deltas.get(t.client_id) || { delta: 0, latestAt: undefined };
          const d = t.type === TransactionType.DEBT ? t.amount : -t.amount;
          const latestAt =
            !prev.latestAt || new Date(t.created_at) > new Date(prev.latestAt)
              ? t.created_at
              : prev.latestAt;
          deltas.set(t.client_id, {
            delta: roundCurrency(prev.delta + d),
            latestAt,
          });
        }
        nextClients = nextClients.map((c) => {
          const info = deltas.get(c.id);
          if (!info) return c;
          return {
            ...c,
            total_balance: roundCurrency(Math.max(0, c.total_balance + info.delta)),
            updated_at: info.latestAt || c.updated_at,
          };
        });
      }
    }
  }

  return { clients: nextClients, transactions: nextTransactions };
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
  justSynced: boolean;
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
  addClient: (
    name: string,
    phone: string,
    creditLimit?: number | null
  ) => Promise<Client | null>;
  updateClient: (
    id: string,
    name: string,
    phone: string,
    creditLimit?: number | null
  ) => Promise<boolean>;
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
    paymentMethod?: PaymentMethod;
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

  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueOp[]>(() =>
    readOfflineQueue(user.id)
  );
  const [clients, setClients] = useState<Client[]>(() => {
    const initial = applyOfflineQueueOptimistically([], [], readOfflineQueue(user.id));
    return initial.clients;
  });
  const [products, setProducts] = useState<Product[]>(
    isSupabaseConfigured ? [] : [{ id: uuid(), name: 'Fert', unit_price: 50, is_default: true }]
  );
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(() => {
    const initial = applyOfflineQueueOptimistically([], [], readOfflineQueue(user.id));
    return initial.transactions;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(isSupabaseConfigured);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const syncingRef = useRef(false);
  const queueRef = useRef<OfflineQueueOp[]>(offlineQueue);
  const clientsRef = useRef<Client[]>(clients);
  const transactionsRef = useRef<LedgerTransaction[]>(transactions);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    queueRef.current = offlineQueue;
    writeOfflineQueue(user.id, offlineQueue);
  }, [offlineQueue, user.id]);

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

  const enqueueOfflineOp = useCallback(
    (op: OfflineQueueOp) => {
      setOfflineQueue((prev) => {
        const next = [...prev, op];
        queueRef.current = next;
        writeOfflineQueue(user.id, next);
        return next;
      });
    },
    [user.id]
  );

  const fetchAndHydrateFromSupabase = useCallback(
    async (remainingQueue: OfflineQueueOp[]) => {
      if (!isSupabaseConfigured || !supabase || !user?.id) return;
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) return;
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

      const remoteClients =
        !clientsRes.error && clientsRes.data ? (clientsRes.data as Client[]) : clientsRef.current;
      const remoteTxs =
        !txRes.error && txRes.data ? (txRes.data as LedgerTransaction[]) : transactionsRef.current;

      if (clientsRes.error) {
        pushToast(`Failed to load clients: ${clientsRes.error.message}`, 'error');
      }
      if (txRes.error) {
        pushToast(`Failed to load transactions: ${txRes.error.message}`, 'error');
      }

      const merged = applyOfflineQueueOptimistically(remoteClients, remoteTxs, remainingQueue);
      setClients(merged.clients);
      setTransactions(merged.transactions);

      if (productsRes.error) {
        pushToast(`Failed to load products: ${productsRes.error.message}`, 'error');
      } else if (productsRes.data && productsRes.data.length > 0) {
        setProducts(productsRes.data as Product[]);
      } else {
        const { data: seeded, error: seedErr } = await supabase
          .from('products')
          .insert({
            user_id: uid,
            name: 'Fert',
            unit_price: 50,
            is_default: true,
          })
          .select('*');
        if (!seedErr && seeded) {
          setProducts(seeded as Product[]);
        }
      }

      await refreshProfile();
    },
    [pushToast, refreshProfile, user?.id]
  );

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !user?.id || syncingRef.current) {
      setIsInitialLoading(false);
      return;
    }
    if (!isOnline) {
      setIsInitialLoading(false);
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) {
        return;
      }
      const uid = authData.user.id;
      const currentQueue = [...queueRef.current];
      const flushedCountInitial = currentQueue.length;
      let failedIndex = -1;

      // Strict FIFO flush
      for (let i = 0; i < currentQueue.length; i++) {
        const op = currentQueue[i];
        try {
          if (op.kind === 'CREATE_CLIENT') {
            const c = op.payload;
            const { error } = await supabase.from('clients').upsert(
              {
                id: c.id,
                user_id: uid,
                name: c.name,
                whatsapp_number: c.whatsapp_number,
                credit_limit: c.credit_limit ?? null,
                created_at: c.created_at,
              },
              { onConflict: 'id' }
            );
            if (error) throw error;
          } else if (op.kind === 'UPDATE_CLIENT') {
            const p = op.payload;
            const { error } = await supabase
              .from('clients')
              .update({
                name: p.name,
                whatsapp_number: p.whatsapp_number,
                credit_limit: p.credit_limit,
              })
              .eq('id', p.id)
              .eq('user_id', uid);
            if (error) throw error;
          } else if (op.kind === 'ADD_TRANSACTIONS') {
            const rows = op.payload.map((t) => ({
              id: t.id,
              user_id: uid,
              client_id: t.client_id,
              client_tx_id: t.client_tx_id || t.id,
              type: t.type,
              payment_method: t.payment_method ?? null,
              product_name: t.product_name,
              quantity: t.quantity,
              split_count: t.split_count,
              amount: t.amount,
              note: t.note ?? null,
              created_at: t.created_at,
            }));
            const { error } = await supabase
              .from('transactions')
              .upsert(rows, { onConflict: 'client_tx_id', ignoreDuplicates: true });
            if (error) throw error;
          }
        } catch (err) {
          failedIndex = i;
          if (!isNetworkFailure(err)) {
            const msg =
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: unknown }).message)
                : 'Sync failed';
            pushToast(`Sync error: ${msg}`, 'error');
          }
          break;
        }
      }

      const remainingQueue = failedIndex === -1 ? [] : currentQueue.slice(failedIndex);
      queueRef.current = remainingQueue;
      setOfflineQueue(remainingQueue);
      writeOfflineQueue(user.id, remainingQueue);

      if (failedIndex === -1) {
        await fetchAndHydrateFromSupabase([]);
        if (flushedCountInitial > 0) {
          setJustSynced(true);
          pushToast(
            `Synced ${flushedCountInitial} offline ${
              flushedCountInitial === 1 ? 'change' : 'changes'
            }`
          );
          window.setTimeout(() => setJustSynced(false), 2800);
        }
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      setIsInitialLoading(false);
    }
  }, [fetchAndHydrateFromSupabase, isOnline, pushToast, user.id]);

  // Flush FIFO queue & fetch user data on login, page reload, and online event
  useEffect(() => {
    if (isSupabaseConfigured && user?.id && isOnline) {
      void syncNow();
    } else {
      setIsInitialLoading(false);
    }
  }, [isOnline, syncNow, user?.id]);

  const getAuthenticatedUserId = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    try {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();
      if (error || !authUser) {
        if (error && isNetworkFailure(error)) return user.id;
        pushToast(error?.message || 'Session expired. Please sign in again.', 'error');
        return null;
      }
      return authUser.id;
    } catch (err) {
      if (isNetworkFailure(err)) return user.id;
      pushToast('Unable to verify session.', 'error');
      return null;
    }
  }, [pushToast, user.id]);

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
    async (
      name: string,
      phone: string,
      creditLimit: number | null = null
    ): Promise<Client | null> => {
      const cleanName = name.trim();
      const formattedPhone = sanitizeWhatsAppNumber(phone, settings.countryCode);
      const cleanLimit = creditLimit && creditLimit > 0 ? roundCurrency(creditLimit) : null;
      const now = new Date().toISOString();
      const newClientId = uuid();

      const optimisticClient: Client = {
        id: newClientId,
        user_id: user.id,
        name: cleanName,
        whatsapp_number: formattedPhone,
        credit_limit: cleanLimit,
        total_balance: 0,
        created_at: now,
        updated_at: now,
      };

      if (isSupabaseConfigured && supabase) {
        if (!isOnline) {
          enqueueOfflineOp({
            id: uuid(),
            kind: 'CREATE_CLIENT',
            payload: optimisticClient,
            createdAt: now,
          });
          setClients((prev) => [optimisticClient, ...prev]);
          pushToast('Saved offline — will sync automatically when online', 'info');
          return optimisticClient;
        }

        const uid = await getAuthenticatedUserId();
        if (!uid) return null;

        try {
          const { data, error } = await supabase
            .from('clients')
            .insert({
              id: newClientId,
              user_id: uid,
              name: cleanName,
              whatsapp_number: formattedPhone,
              credit_limit: cleanLimit,
            })
            .select('*')
            .single();

          if (error) {
            if (isNetworkFailure(error)) {
              enqueueOfflineOp({
                id: uuid(),
                kind: 'CREATE_CLIENT',
                payload: { ...optimisticClient, user_id: uid },
                createdAt: now,
              });
              setClients((prev) => [{ ...optimisticClient, user_id: uid }, ...prev]);
              pushToast('Saved offline — will sync automatically when online', 'info');
              return { ...optimisticClient, user_id: uid };
            }
            pushToast(`Could not add client: ${error.message}`, 'error');
            return null;
          }

          const created = data as Client;
          setClients((prev) => [created, ...prev]);
          pushToast(`Added ${created.name}`);
          return created;
        } catch (err) {
          if (isNetworkFailure(err)) {
            enqueueOfflineOp({
              id: uuid(),
              kind: 'CREATE_CLIENT',
              payload: { ...optimisticClient, user_id: uid },
              createdAt: now,
            });
            setClients((prev) => [{ ...optimisticClient, user_id: uid }, ...prev]);
            pushToast('Saved offline — will sync automatically when online', 'info');
            return { ...optimisticClient, user_id: uid };
          }
          pushToast('Could not add client due to an unexpected error', 'error');
          return null;
        }
      }

      setClients((prev) => [optimisticClient, ...prev]);
      pushToast(`Added ${optimisticClient.name}`);
      return optimisticClient;
    },
    [enqueueOfflineOp, getAuthenticatedUserId, isOnline, pushToast, settings.countryCode, user.id]
  );

  const updateClient = useCallback(
    async (
      id: string,
      name: string,
      phone: string,
      creditLimit: number | null = null
    ): Promise<boolean> => {
      const cleanName = name.trim();
      const formatted = sanitizeWhatsAppNumber(phone, settings.countryCode);
      const cleanLimit = creditLimit && creditLimit > 0 ? roundCurrency(creditLimit) : null;
      const now = new Date().toISOString();

      const applyLocal = () => {
        setClients((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name: cleanName,
                  whatsapp_number: formatted,
                  credit_limit: cleanLimit,
                  updated_at: now,
                }
              : c
          )
        );
      };

      if (isSupabaseConfigured && supabase) {
        if (!isOnline) {
          enqueueOfflineOp({
            id: uuid(),
            kind: 'UPDATE_CLIENT',
            payload: {
              id,
              name: cleanName,
              whatsapp_number: formatted,
              credit_limit: cleanLimit,
              updated_at: now,
            },
            createdAt: now,
          });
          applyLocal();
          pushToast('Saved offline — will sync automatically when online', 'info');
          return true;
        }

        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        try {
          const { data, error } = await supabase
            .from('clients')
            .update({
              name: cleanName,
              whatsapp_number: formatted,
              credit_limit: cleanLimit,
            })
            .eq('id', id)
            .eq('user_id', uid)
            .select('*')
            .single();

          if (error) {
            if (isNetworkFailure(error)) {
              enqueueOfflineOp({
                id: uuid(),
                kind: 'UPDATE_CLIENT',
                payload: {
                  id,
                  name: cleanName,
                  whatsapp_number: formatted,
                  credit_limit: cleanLimit,
                  updated_at: now,
                },
                createdAt: now,
              });
              applyLocal();
              pushToast('Saved offline — will sync automatically when online', 'info');
              return true;
            }
            pushToast(`Could not update client: ${error.message}`, 'error');
            return false;
          }

          setClients((prev) => prev.map((c) => (c.id === id ? (data as Client) : c)));
          pushToast('Client details updated');
          return true;
        } catch (err) {
          if (isNetworkFailure(err)) {
            enqueueOfflineOp({
              id: uuid(),
              kind: 'UPDATE_CLIENT',
              payload: {
                id,
                name: cleanName,
                whatsapp_number: formatted,
                credit_limit: cleanLimit,
                updated_at: now,
              },
              createdAt: now,
            });
            applyLocal();
            pushToast('Saved offline — will sync automatically when online', 'info');
            return true;
          }
          pushToast('Could not update client', 'error');
          return false;
        }
      }

      applyLocal();
      pushToast('Client details updated');
      return true;
    },
    [enqueueOfflineOp, getAuthenticatedUserId, isOnline, pushToast, settings.countryCode]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<boolean> => {
      if (isSupabaseConfigured && supabase) {
        if (!isOnline) {
          pushToast('Deleting clients requires an internet connection', 'error');
          return false;
        }
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
    [getAuthenticatedUserId, isOnline, pushToast]
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

      const debtTxs: LedgerTransaction[] = clientIds.map((clientId, idx) => {
        const txId = uuid();
        return {
          id: txId,
          user_id: user.id,
          client_id: clientId,
          client_tx_id: uuid(),
          type: TransactionType.DEBT,
          product_name: productName,
          quantity,
          split_count: splitCount,
          amount: debtShares[idx],
          note: combinedNote,
          created_at: debtTime,
        };
      });

      const depositTxs: LedgerTransaction[] =
        deposit > 0
          ? clientIds
              .map((clientId, idx) => ({
                id: uuid(),
                user_id: user.id,
                client_id: clientId,
                client_tx_id: uuid(),
                type: TransactionType.PAYMENT,
                payment_method: 'CASH' as PaymentMethod,
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

      const allOptimistic = [...depositTxs, ...debtTxs];

      const applyOptimistically = (pendingSync: boolean) => {
        const marked = allOptimistic.map((t) => ({ ...t, pending_sync: pendingSync }));
        setTransactions((prevTx) => {
          const nextTx = [...marked, ...prevTx];
          setClients((prevClients) => recomputeBalances(prevClients, nextTx));
          return nextTx;
        });
      };

      if (isSupabaseConfigured && supabase) {
        if (!isOnline) {
          enqueueOfflineOp({
            id: uuid(),
            kind: 'ADD_TRANSACTIONS',
            payload: [...debtTxs, ...depositTxs],
            createdAt: debtTime,
          });
          applyOptimistically(true);
          triggerHaptic(18);
          pushToast('Saved offline — will sync automatically when online', 'info');
          return true;
        }

        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        const rowsToUpsert = [...debtTxs, ...depositTxs].map((t) => ({
          id: t.id,
          user_id: uid,
          client_id: t.client_id,
          client_tx_id: t.client_tx_id,
          type: t.type,
          payment_method: t.payment_method ?? null,
          product_name: t.product_name,
          quantity: t.quantity,
          split_count: t.split_count,
          amount: t.amount,
          note: t.note ?? null,
          created_at: t.created_at,
        }));

        try {
          const { data: insertedTxs, error: insertError } = await supabase
            .from('transactions')
            .upsert(rowsToUpsert, { onConflict: 'client_tx_id', ignoreDuplicates: true })
            .select('*');

          if (insertError) {
            if (isNetworkFailure(insertError)) {
              enqueueOfflineOp({
                id: uuid(),
                kind: 'ADD_TRANSACTIONS',
                payload: [...debtTxs, ...depositTxs].map((t) => ({ ...t, user_id: uid })),
                createdAt: debtTime,
              });
              applyOptimistically(true);
              triggerHaptic(18);
              pushToast('Saved offline — will sync automatically when online', 'info');
              return true;
            }
            pushToast(`Failed to save sale: ${insertError.message}`, 'error');
            return false;
          }

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
            const merged = applyOfflineQueueOptimistically(
              refreshedClients as Client[],
              transactionsRef.current,
              queueRef.current
            );
            setClients(merged.clients);
          }
        } catch (err) {
          if (isNetworkFailure(err)) {
            enqueueOfflineOp({
              id: uuid(),
              kind: 'ADD_TRANSACTIONS',
              payload: [...debtTxs, ...depositTxs].map((t) => ({ ...t, user_id: uid })),
              createdAt: debtTime,
            });
            applyOptimistically(true);
            triggerHaptic(18);
            pushToast('Saved offline — will sync automatically when online', 'info');
            return true;
          }
          pushToast('Failed to save sale', 'error');
          return false;
        }
      } else {
        applyOptimistically(false);
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
    [clients, enqueueOfflineOp, getAuthenticatedUserId, isOnline, pushToast, settings.currency, user.id]
  );

  const recordPayment = useCallback(
    async ({
      clientId,
      amount,
      note,
      paymentMethod = 'CASH',
    }: {
      clientId: string;
      amount: number;
      note?: string;
      paymentMethod?: PaymentMethod;
    }): Promise<boolean> => {
      if (amount <= 0) return false;
      const cleanAmount = roundCurrency(amount);
      const now = new Date().toISOString();
      const paymentTx: LedgerTransaction = {
        id: uuid(),
        user_id: user.id,
        client_id: clientId,
        client_tx_id: uuid(),
        type: TransactionType.PAYMENT,
        payment_method: paymentMethod,
        product_name: 'Payment',
        quantity: 1,
        split_count: 1,
        amount: cleanAmount,
        note: note?.trim() || undefined,
        created_at: now,
      };

      const applyOptimistically = (pendingSync: boolean) => {
        setTransactions((prevTx) => {
          const nextTx = [{ ...paymentTx, pending_sync: pendingSync }, ...prevTx];
          setClients((prevClients) => recomputeBalances(prevClients, nextTx));
          return nextTx;
        });
      };

      if (isSupabaseConfigured && supabase) {
        if (!isOnline) {
          enqueueOfflineOp({
            id: uuid(),
            kind: 'ADD_TRANSACTIONS',
            payload: [paymentTx],
            createdAt: now,
          });
          applyOptimistically(true);
          triggerHaptic(16);
          pushToast('Saved offline — will sync automatically when online', 'info');
          return true;
        }

        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        try {
          const { data, error } = await supabase
            .from('transactions')
            .upsert(
              {
                id: paymentTx.id,
                user_id: uid,
                client_id: clientId,
                client_tx_id: paymentTx.client_tx_id,
                type: TransactionType.PAYMENT,
                payment_method: paymentMethod,
                product_name: 'Payment',
                quantity: 1,
                split_count: 1,
                amount: cleanAmount,
                note: note?.trim() || null,
                created_at: now,
              },
              { onConflict: 'client_tx_id', ignoreDuplicates: true }
            )
            .select('*')
            .single();

          if (error) {
            if (isNetworkFailure(error)) {
              enqueueOfflineOp({
                id: uuid(),
                kind: 'ADD_TRANSACTIONS',
                payload: [{ ...paymentTx, user_id: uid }],
                createdAt: now,
              });
              applyOptimistically(true);
              triggerHaptic(16);
              pushToast('Saved offline — will sync automatically when online', 'info');
              return true;
            }
            pushToast(`Could not save payment: ${error.message}`, 'error');
            return false;
          }

          const { data: updatedClient } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .eq('user_id', uid)
            .single();

          if (data) {
            setTransactions((prev) => [data as LedgerTransaction, ...prev]);
          }
          if (updatedClient) {
            setClients((prev) =>
              prev.map((c) => (c.id === clientId ? (updatedClient as Client) : c))
            );
          }
        } catch (err) {
          if (isNetworkFailure(err)) {
            enqueueOfflineOp({
              id: uuid(),
              kind: 'ADD_TRANSACTIONS',
              payload: [{ ...paymentTx, user_id: uid }],
              createdAt: now,
            });
            applyOptimistically(true);
            triggerHaptic(16);
            pushToast('Saved offline — will sync automatically when online', 'info');
            return true;
          }
          pushToast('Could not save payment', 'error');
          return false;
        }
      } else {
        applyOptimistically(false);
      }

      triggerHaptic(16);
      const clientName = clients.find((c) => c.id === clientId)?.name || 'Client';
      pushToast(`Recorded ${settings.currency} ${cleanAmount} from ${clientName}`);
      return true;
    },
    [clients, enqueueOfflineOp, getAuthenticatedUserId, isOnline, pushToast, settings.currency, user.id]
  );

  const voidTransaction = useCallback(
    async (txId: string): Promise<boolean> => {
      const targetTx = transactions.find((t) => t.id === txId);

      if (isSupabaseConfigured && supabase) {
        if (!isOnline) {
          pushToast('Voiding entries requires an internet connection', 'error');
          return false;
        }
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
    [getAuthenticatedUserId, isOnline, pushToast, transactions]
  );

  const upsertProduct = useCallback(
    async (product: Omit<Product, 'id'> & { id?: string }): Promise<boolean> => {
      const cleanName = product.name.trim();
      const cleanPrice = roundCurrency(product.unit_price);

      if (isSupabaseConfigured && supabase) {
        const uid = await getAuthenticatedUserId();
        if (!uid) return false;

        if (product.is_default) {
          await supabase.from('products').update({ is_default: false }).eq('user_id', uid);
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
      'Credit Limit',
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
        c?.credit_limit ?? 'Unlimited',
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
          credit_limit: c.credit_limit ?? null,
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
          client_tx_id: uuid(),
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

      await fetchAndHydrateFromSupabase(queueRef.current);
      pushToast('Added sample shop data to your database', 'info');
      return;
    }

    setClients(starter.clients);
    setProducts(starter.products);
    setTransactions(starter.transactions);
    pushToast('Loaded sample shop data', 'info');
  }, [fetchAndHydrateFromSupabase, getAuthenticatedUserId, pushToast]);

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
    // ONLY clear in-memory React state — NEVER wipe denibook_offline_queue_<userId> or DB records
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
        pendingOpsCount: offlineQueue.length,
        isOnline,
        isSyncing,
        justSynced,
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
        syncNow,
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
