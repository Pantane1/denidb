import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppSettings,
  Client,
  LedgerTransaction,
  PendingSyncOp,
  Product,
  ToastItem,
  TransactionType,
} from '../types';
import { isSameLocalDay, roundCurrency, splitAmountEvenly } from './currency';
import { DEFAULT_WHATSAPP_TEMPLATE, sanitizeWhatsAppNumber } from './phone';
import { isSupabaseConfigured, supabase } from './supabase';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { Session } from '@supabase/supabase-js';

const KEYS = {
  clients: 'denibook_clients_v1',
  products: 'denibook_products_v1',
  transactions: 'denibook_transactions_v1',
  settings: 'denibook_settings_v1',
  pending: 'denibook_pending_ops_v1',
  initialized: 'denibook_initialized_v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'DeniBook',
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

function createStarterData(): {
  clients: Client[];
  products: Product[];
  transactions: LedgerTransaction[];
} {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  const fertId = uuid();
  const products: Product[] = [
    { id: fertId, name: 'Fert', unit_price: 50, is_default: true },
    { id: uuid(), name: 'Seeds Pack', unit_price: 120, is_default: false },
    { id: uuid(), name: 'Feed 2kg', unit_price: 200, is_default: false },
  ];

  const c1 = uuid();
  const c2 = uuid();
  const c3 = uuid();
  const c4 = uuid();
  const c5 = uuid();

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
      client_id: c3,
      type: TransactionType.DEBT,
      product_name: 'Seeds Pack',
      quantity: 2,
      split_count: 1,
      amount: 240,
      created_at: hoursAgo(26),
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
    {
      id: uuid(),
      client_id: c5,
      type: TransactionType.DEBT,
      product_name: 'Feed 2kg',
      quantity: 2,
      split_count: 1,
      amount: 400,
      created_at: hoursAgo(50),
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
    {
      id: c5,
      name: 'Amina Hassan',
      whatsapp_number: '254756789012',
      total_balance: 0,
      created_at: hoursAgo(72),
      updated_at: hoursAgo(50),
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

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
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
  isLocked: boolean;
  session: Session | null;
  toasts: ToastItem[];
  kpis: {
    totalOwed: number;
    addedToday: number;
    collectedToday: number;
  };
  unlockWithPin: (pin: string) => boolean;
  lockApp: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: string) => void;
  addClient: (name: string, phone: string) => Client;
  updateClient: (id: string, name: string, phone: string) => void;
  deleteClient: (id: string) => void;
  saveDebtSale: (params: {
    clientIds: string[];
    productName: string;
    quantity: number;
    totalAmount: number;
    note?: string;
  }) => Promise<void>;
  recordPayment: (params: {
    clientId: string;
    amount: number;
    note?: string;
  }) => Promise<void>;
  voidTransaction: (txId: string) => Promise<void>;
  upsertProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  deleteProduct: (productId: string) => void;
  setDefaultProduct: (productId: string) => void;
  exportCsv: () => void;
  resetDemoData: () => void;
  clearAllRecords: () => void;
  syncNow: () => Promise<void>;
}

const DeniBookContext = createContext<DeniBookContextValue | null>(null);

export const DeniBookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...readJson<Partial<AppSettings>>(KEYS.settings, {}),
  }));

  const initialSeed = useMemo(() => {
    const alreadyInit = localStorage.getItem(KEYS.initialized);
    if (!alreadyInit) {
      const starter = createStarterData();
      localStorage.setItem(KEYS.clients, JSON.stringify(starter.clients));
      localStorage.setItem(KEYS.products, JSON.stringify(starter.products));
      localStorage.setItem(KEYS.transactions, JSON.stringify(starter.transactions));
      localStorage.setItem(KEYS.initialized, '1');
      return starter;
    }
    const clients = readJson<Client[]>(KEYS.clients, []);
    const products = readJson<Product[]>(KEYS.products, [
      { id: uuid(), name: 'Fert', unit_price: 50, is_default: true },
    ]);
    const transactions = readJson<LedgerTransaction[]>(KEYS.transactions, []);
    return {
      clients: recomputeBalances(clients, transactions),
      products,
      transactions,
    };
  }, []);

  const [clients, setClients] = useState<Client[]>(initialSeed.clients);
  const [products, setProducts] = useState<Product[]>(initialSeed.products);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(initialSeed.transactions);
  const [pendingOps, setPendingOps] = useState<PendingSyncOp[]>(() =>
    readJson<PendingSyncOp[]>(KEYS.pending, [])
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const saved = readJson<Partial<AppSettings>>(KEYS.settings, {});
    return Boolean(saved.pinEnabled);
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const syncingRef = useRef(false);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Persist local cache
  useEffect(() => {
    localStorage.setItem(KEYS.clients, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(KEYS.products, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(KEYS.transactions, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(KEYS.pending, JSON.stringify(pendingOps));
  }, [pendingOps]);

  const pushToast = useCallback((message: string, tone: ToastItem['tone'] = 'success') => {
    const id = uuid();
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Supabase auth session listener
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !session || !isOnline || syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const remaining: PendingSyncOp[] = [];
      for (const op of pendingOps) {
        try {
          if (op.kind === 'ADD_CLIENT') {
            const c = op.payload as Client;
            const { error } = await supabase.from('clients').upsert({
              id: c.id,
              name: c.name,
              whatsapp_number: c.whatsapp_number,
              created_at: c.created_at,
            });
            if (error) throw error;
          } else if (op.kind === 'UPDATE_CLIENT') {
            const c = op.payload as { id: string; name: string; whatsapp_number: string };
            const { error } = await supabase
              .from('clients')
              .update({ name: c.name, whatsapp_number: c.whatsapp_number })
              .eq('id', c.id);
            if (error) throw error;
          } else if (op.kind === 'DELETE_CLIENT') {
            const id = op.payload as string;
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) throw error;
          } else if (op.kind === 'ADD_TRANSACTIONS') {
            const txs = op.payload as LedgerTransaction[];
            const { error } = await supabase.from('transactions').insert(
              txs.map((t) => ({
                id: t.id,
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
            if (error) throw error;
          } else if (op.kind === 'VOID_TRANSACTION') {
            const id = op.payload as string;
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
          } else if (op.kind === 'UPSERT_PRODUCT') {
            const p = op.payload as Product;
            const { error } = await supabase.from('products').upsert({
              id: p.id,
              name: p.name,
              unit_price: p.unit_price,
              is_default: p.is_default,
            });
            if (error) throw error;
          } else if (op.kind === 'DELETE_PRODUCT') {
            const id = op.payload as string;
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
          }
        } catch {
          remaining.push(op);
        }
      }
      setPendingOps(remaining);

      if (remaining.length === 0) {
        const [clientsRes, productsRes, txRes] = await Promise.all([
          supabase.from('clients').select('*').order('name', { ascending: true }),
          supabase.from('products').select('*').order('created_at', { ascending: true }),
          supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(1000),
        ]);
        if (!clientsRes.error && clientsRes.data && clientsRes.data.length > 0) {
          setClients(clientsRes.data as Client[]);
        }
        if (!productsRes.error && productsRes.data && productsRes.data.length > 0) {
          setProducts(productsRes.data as Product[]);
        }
        if (!txRes.error && txRes.data) {
          setTransactions(txRes.data as LedgerTransaction[]);
        }
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, pendingOps, session]);

  useEffect(() => {
    if (isOnline && session && pendingOps.length > 0) {
      syncNow();
    }
  }, [isOnline, session, pendingOps.length, syncNow]);

  const enqueueOp = useCallback((kind: PendingSyncOp['kind'], payload: unknown) => {
    if (!isSupabaseConfigured) return;
    setPendingOps((prev) => [
      ...prev,
      { id: uuid(), kind, payload, createdAt: new Date().toISOString() },
    ]);
  }, []);

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

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const addClient = useCallback(
    (name: string, phone: string) => {
      const now = new Date().toISOString();
      const newClient: Client = {
        id: uuid(),
        name: name.trim(),
        whatsapp_number: sanitizeWhatsAppNumber(phone, settings.countryCode),
        total_balance: 0,
        created_at: now,
        updated_at: now,
      };
      setClients((prev) => [newClient, ...prev]);
      enqueueOp('ADD_CLIENT', newClient);
      pushToast(`Added ${newClient.name}`);
      return newClient;
    },
    [enqueueOp, pushToast, settings.countryCode]
  );

  const updateClient = useCallback(
    (id: string, name: string, phone: string) => {
      const formatted = sanitizeWhatsAppNumber(phone, settings.countryCode);
      setClients((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, name: name.trim(), whatsapp_number: formatted, updated_at: new Date().toISOString() }
            : c
        )
      );
      enqueueOp('UPDATE_CLIENT', { id, name: name.trim(), whatsapp_number: formatted });
      pushToast('Client details updated');
    },
    [enqueueOp, pushToast, settings.countryCode]
  );

  const deleteClient = useCallback(
    (id: string) => {
      setClients((prev) => prev.filter((c) => c.id !== id));
      setTransactions((prev) => prev.filter((t) => t.client_id !== id));
      enqueueOp('DELETE_CLIENT', id);
      pushToast('Client removed', 'info');
    },
    [enqueueOp, pushToast]
  );

  const saveDebtSale = useCallback(
    async ({
      clientIds,
      productName,
      quantity,
      totalAmount,
      note,
    }: {
      clientIds: string[];
      productName: string;
      quantity: number;
      totalAmount: number;
      note?: string;
    }) => {
      if (clientIds.length === 0 || totalAmount <= 0) return;

      const splitCount = clientIds.length;
      const shares = splitAmountEvenly(totalAmount, splitCount);
      const now = new Date().toISOString();

      const newTransactions: LedgerTransaction[] = clientIds.map((clientId, idx) => ({
        id: uuid(),
        client_id: clientId,
        type: TransactionType.DEBT,
        product_name: productName,
        quantity,
        split_count: splitCount,
        amount: shares[idx],
        note: note || (splitCount > 1 ? `Split ${splitCount} ways` : undefined),
        created_at: now,
        pending_sync: Boolean(isSupabaseConfigured),
      }));

      setTransactions((prevTx) => {
        const nextTx = [...newTransactions, ...prevTx];
        setClients((prevClients) => recomputeBalances(prevClients, nextTx));
        return nextTx;
      });

      enqueueOp('ADD_TRANSACTIONS', newTransactions);
      triggerHaptic(18);

      const names = clients
        .filter((c) => clientIds.includes(c.id))
        .map((c) => c.name.split(' ')[0]);
      const nameSummary =
        names.length <= 2
          ? names.join(' & ')
          : `${names[0]} & ${names.length - 1} others`;

      const perShare = shares[0];
      pushToast(
        splitCount > 1
          ? `Saved ${settings.currency} ${perShare} each to ${nameSummary}`
          : `Saved ${settings.currency} ${totalAmount} to ${nameSummary}`
      );
    },
    [clients, enqueueOp, pushToast, settings.currency]
  );

  const recordPayment = useCallback(
    async ({ clientId, amount, note }: { clientId: string; amount: number; note?: string }) => {
      if (amount <= 0) return;
      const now = new Date().toISOString();
      const paymentTx: LedgerTransaction = {
        id: uuid(),
        client_id: clientId,
        type: TransactionType.PAYMENT,
        product_name: 'Payment',
        quantity: 1,
        split_count: 1,
        amount: roundCurrency(amount),
        note: note?.trim() || undefined,
        created_at: now,
        pending_sync: Boolean(isSupabaseConfigured),
      };

      setTransactions((prevTx) => {
        const nextTx = [paymentTx, ...prevTx];
        setClients((prevClients) => recomputeBalances(prevClients, nextTx));
        return nextTx;
      });

      enqueueOp('ADD_TRANSACTIONS', [paymentTx]);
      triggerHaptic(16);

      const clientName = clients.find((c) => c.id === clientId)?.name || 'Client';
      pushToast(`Recorded ${settings.currency} ${roundCurrency(amount)} from ${clientName}`);
    },
    [clients, enqueueOp, pushToast, settings.currency]
  );

  const voidTransaction = useCallback(
    async (txId: string) => {
      setTransactions((prevTx) => {
        const nextTx = prevTx.filter((t) => t.id !== txId);
        setClients((prevClients) => recomputeBalances(prevClients, nextTx));
        return nextTx;
      });
      enqueueOp('VOID_TRANSACTION', txId);
      triggerHaptic(12);
      pushToast('Entry voided & balance recalculated', 'info');
    },
    [enqueueOp, pushToast]
  );

  const upsertProduct = useCallback(
    (product: Omit<Product, 'id'> & { id?: string }) => {
      const targetId = product.id || uuid();
      const clean: Product = {
        id: targetId,
        name: product.name.trim(),
        unit_price: roundCurrency(product.unit_price),
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
      enqueueOp('UPSERT_PRODUCT', clean);
      pushToast(`Saved item "${clean.name}"`);
    },
    [enqueueOp, pushToast]
  );

  const deleteProduct = useCallback(
    (productId: string) => {
      setProducts((prev) => {
        const filtered = prev.filter((p) => p.id !== productId);
        if (filtered.length > 0 && !filtered.some((p) => p.is_default)) {
          filtered[0] = { ...filtered[0], is_default: true };
        }
        return filtered;
      });
      enqueueOp('DELETE_PRODUCT', productId);
      pushToast('Item removed', 'info');
    },
    [enqueueOp, pushToast]
  );

  const setDefaultProduct = useCallback(
    (productId: string) => {
      setProducts((prev) =>
        prev.map((p) => ({ ...p, is_default: p.id === productId }))
      );
      const target = products.find((p) => p.id === productId);
      if (target) {
        enqueueOp('UPSERT_PRODUCT', { ...target, is_default: true });
      }
    },
    [enqueueOp, products]
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
    link.download = `denibook-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast('Downloaded CSV ledger backup');
  }, [clients, pushToast, transactions]);

  const resetDemoData = useCallback(() => {
    const starter = createStarterData();
    setClients(starter.clients);
    setProducts(starter.products);
    setTransactions(starter.transactions);
    setPendingOps([]);
    pushToast('Restored starter ledger data', 'info');
  }, [pushToast]);

  const clearAllRecords = useCallback(() => {
    setClients([]);
    setTransactions([]);
    setPendingOps([]);
    pushToast('Cleared all clients and ledger entries', 'info');
  }, [pushToast]);

  return (
    <DeniBookContext.Provider
      value={{
        clients,
        products,
        transactions,
        settings,
        pendingOpsCount: pendingOps.length,
        isOnline,
        isSyncing,
        isLocked,
        session,
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
