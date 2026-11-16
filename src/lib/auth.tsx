import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthUser, UserProfile } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

const LOCAL_ACCOUNTS_KEY = 'denibook_local_accounts_v1';
const LOCAL_SESSION_KEY = 'denibook_local_session_v1';

interface LocalAccountRecord {
  id: string;
  email: string;
  password: string;
  shop_name: string;
}

interface AuthResult {
  error?: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isSupabaseMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, shopName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, 'shop_name' | 'currency' | 'country_code'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function clearTenantStorageCache(userId: string): void {
  try {
    const prefix = `denibook_v2_${userId}_`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

function readLocalAccounts(): LocalAccountRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as LocalAccountRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: LocalAccountRecord[]): void {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSupabaseProfile = useCallback(async (activeSession: Session) => {
    if (!supabase) return;
    const uid = activeSession.user.id;
    const fallbackShop =
      (activeSession.user.user_metadata?.shop_name as string | undefined)?.trim() || 'My Shop';

    const { data, error } = await supabase
      .from('profiles')
      .select('id, shop_name, currency, country_code')
      .eq('id', uid)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as UserProfile);
      return;
    }

    // If profile row does not exist yet, upsert one cleanly for this user
    const { data: upserted } = await supabase
      .from('profiles')
      .upsert({ id: uid, shop_name: fallbackShop })
      .select('id, shop_name, currency, country_code')
      .maybeSingle();

    setProfile(
      (upserted as UserProfile | null) ?? {
        id: uid,
        shop_name: fallbackShop,
        currency: 'KES',
        country_code: '254',
      }
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        if (!mounted) return;
        const currentSession = data.session ?? null;
        setSession(currentSession);
        if (currentSession) {
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
          });
          await loadSupabaseProfile(currentSession);
        } else {
          setUser(null);
          setProfile(null);
        }
        if (mounted) setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        if (nextSession) {
          setUser({
            id: nextSession.user.id,
            email: nextSession.user.email || '',
          });
          await loadSupabaseProfile(nextSession);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    // Local multi-tenant auth fallback when Supabase env vars are not set
    try {
      const savedUserId = localStorage.getItem(LOCAL_SESSION_KEY);
      if (savedUserId) {
        const accounts = readLocalAccounts();
        const found = accounts.find((a) => a.id === savedUserId);
        if (found) {
          setUser({ id: found.id, email: found.email });
          setProfile({
            id: found.id,
            shop_name: found.shop_name,
            currency: 'KES',
            country_code: '254',
          });
        }
      }
    } finally {
      if (mounted) setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [loadSupabaseProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const cleanEmail = email.trim().toLowerCase();
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) {
          return { error: error.message };
        }
        if (data.session) {
          setSession(data.session);
          setUser({ id: data.session.user.id, email: data.session.user.email || cleanEmail });
          await loadSupabaseProfile(data.session);
        }
        return {};
      }

      // Local fallback sign-in
      const accounts = readLocalAccounts();
      const matched = accounts.find(
        (a) => a.email.toLowerCase() === cleanEmail && a.password === password
      );
      if (!matched) {
        return { error: 'Invalid email or password.' };
      }
      localStorage.setItem(LOCAL_SESSION_KEY, matched.id);
      setUser({ id: matched.id, email: matched.email });
      setProfile({
        id: matched.id,
        shop_name: matched.shop_name,
        currency: 'KES',
        country_code: '254',
      });
      return {};
    },
    [loadSupabaseProfile]
  );

  const signUp = useCallback(
    async (email: string, password: string, shopName: string): Promise<AuthResult> => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanShop = shopName.trim() || 'My Shop';

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              shop_name: cleanShop,
            },
          },
        });
        if (error) {
          return { error: error.message };
        }
        if (data.session) {
          setSession(data.session);
          setUser({ id: data.session.user.id, email: data.session.user.email || cleanEmail });
          await loadSupabaseProfile(data.session);
          return {};
        }
        return { needsEmailConfirmation: true };
      }

      // Local fallback sign-up
      const accounts = readLocalAccounts();
      if (accounts.some((a) => a.email.toLowerCase() === cleanEmail)) {
        return { error: 'An account with this email already exists.' };
      }
      const newId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `local-${Date.now()}`;
      const record: LocalAccountRecord = {
        id: newId,
        email: cleanEmail,
        password,
        shop_name: cleanShop,
      };
      writeLocalAccounts([...accounts, record]);
      localStorage.setItem(LOCAL_SESSION_KEY, record.id);
      setUser({ id: record.id, email: record.email });
      setProfile({
        id: record.id,
        shop_name: record.shop_name,
        currency: 'KES',
        country_code: '254',
      });
      return {};
    },
    [loadSupabaseProfile]
  );

  const signOut = useCallback(async () => {
    const activeUserId = user?.id;
    if (activeUserId) {
      clearTenantStorageCache(activeUserId);
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }

    setSession(null);
    setUser(null);
    setProfile(null);
  }, [user?.id]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<UserProfile, 'shop_name' | 'currency' | 'country_code'>>) => {
      if (!user) return;
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));

      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('profiles')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } else if (patch.shop_name) {
        const accounts = readLocalAccounts();
        writeLocalAccounts(
          accounts.map((a) => (a.id === user.id ? { ...a, shop_name: patch.shop_name! } : a))
        );
      }
    },
    [user]
  );

  const refreshProfile = useCallback(async () => {
    if (isSupabaseConfigured && session) {
      await loadSupabaseProfile(session);
    }
  }, [loadSupabaseProfile, session]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isSupabaseMode: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
