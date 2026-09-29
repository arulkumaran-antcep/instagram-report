import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let client: SupabaseClient | null = null;

// Service-role client: bypasses row level security. Server code only, and
// only after the caller has been checked with requireMember().
export const adminDb = (): SupabaseClient => {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return client;
};

export const REPORTS_BUCKET = 'reports';
