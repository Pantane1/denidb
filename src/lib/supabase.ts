import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasValidConfig =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl?.includes('your-project.supabase.co') &&
  !supabaseAnonKey?.includes('your-supabase-anon-key');

export const isSupabaseConfigured = hasValidConfig;

export const supabase: SupabaseClient | null = hasValidConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
