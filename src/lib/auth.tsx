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
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, shopName: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  completePasswordReset: (newPassword: string) => Promise<AuthResult>;
  dismissPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<UserProfile, 'shop_name' | 'currency' | 'country_code' | 'whatsapp_template'>>
  ) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

function hasRecoveryTokenInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return (
    hash.includes('type=recovery') ||
    new URLSearchParams(search).get('type') === 'recovery'
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() =>
    hasRecoveryTokenInUrl()
  );

  const fetchSupabaseProfile = useCallback(async (uid: string, fallbackShop = 'My Shop') => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, shop_name, currency, country_code, whatsapp_template')
      .eq('id', uid)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as UserProfile);
      return;
    }

    // Create missing profile row if trigger had not yet populated it
    const { data: upserted } = await supabase
      .from('profiles')
      .upsert({ id: uid, shop_name: fallbackShop })
      .select('id, shop_name, currency, country_code, whatsapp_template')
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
        } else {
          setUser(null);
          setProfile(null);
        }
        if (mounted) setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted) return;
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        setSession(nextSession);
        if (nextSession) {
          setUser({
            id: nextSession.user.id,
            email: nextSession.user.email || '',
          });
        } else {
          setUser(null);
          setProfile(null);
          if (event === 'SIGNED_OUT') {
            setIsPasswordRecovery(false);
          }
        }
        setLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    // Fallback ONLY when Supabase env vars are not configured
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
  }, []);

  // Fetch profile from Supabase whenever authenticated user?.id changes
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user?.id) return;
    const fallbackShop =
      (session?.user.user_metadata?.shop_name as string | undefined)?.trim() || 'My Shop';
    void fetchSupabaseProfile(user.id, fallbackShop);
  }, [fetchSupabaseProfile, session?.user.user_metadata?.shop_name, user?.id]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
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
      }
      return {};
    }

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
  }, []);

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
          return {};
        }
        return { needsEmailConfirmation: true };
      }

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
    []
  );

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { error: 'Enter your account email address.' };
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    }

    const accounts = readLocalAccounts();
    if (!accounts.some((a) => a.email.toLowerCase() === cleanEmail)) {
      return { error: 'No local preview account found with that email.' };
    }
    return {};
  }, []);

  const completePasswordReset = useCallback(async (newPassword: string): Promise<AuthResult> => {
    if (newPassword.length < 6) {
      return { error: 'Password must be at least 6 characters.' };
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { error: error.message };
      }
    }

    if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setIsPasswordRecovery(false);
    return {};
  }, []);

  const dismissPasswordRecovery = useCallback(() => {
    if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setIsPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }
    // Only clear in-memory session/user/profile state — NEVER delete DB records
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsPasswordRecovery(false);
  }, []);

  const updateProfile = useCallback(
    async (
      patch: Partial<Pick<UserProfile, 'shop_name' | 'currency' | 'country_code' | 'whatsapp_template'>>
    ): Promise<{ error?: string }> => {
      if (!user) return { error: 'Not authenticated' };

      if (isSupabaseConfigured && supabase) {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          return { error: authError?.message || 'Session expired. Please sign in again.' };
        }

        const { data, error } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            ...patch,
            updated_at: new Date().toISOString(),
          })
          .select('id, shop_name, currency, country_code, whatsapp_template')
          .single();

        if (error) {
          return { error: error.message };
        }
        setProfile(data as UserProfile);
        return {};
      }

      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      if (patch.shop_name) {
        const accounts = readLocalAccounts();
        writeLocalAccounts(
          accounts.map((a) => (a.id === user.id ? { ...a, shop_name: patch.shop_name! } : a))
        );
      }
      return {};
    },
    [user]
  );

  const refreshProfile = useCallback(async () => {
    if (isSupabaseConfigured && user?.id) {
      await fetchSupabaseProfile(user.id);
    }
  }, [fetchSupabaseProfile, user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isSupabaseMode: isSupabaseConfigured,
        isPasswordRecovery,
        signIn,
        signUp,
        requestPasswordReset,
        completePasswordReset,
        dismissPasswordRecovery,
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
