import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'MY_SUPABASE_URL' &&
    supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    })
  : null;

export const REQUIRED_ENV_VARS = [
  {
    name: 'VITE_SUPABASE_URL',
    description: 'Public URL of your Supabase project (e.g. https://xyzcompany.supabase.co)',
    configured: Boolean(supabaseUrl && supabaseUrl.startsWith('http')),
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    description: 'Public anonymous client key (safe for browser with RLS enabled; never use service_role)',
    configured: Boolean(supabaseAnonKey && supabaseAnonKey.length > 10),
  },
  {
    name: 'VITE_TURN_URL',
    description: 'Optional WebRTC TURN relay server URL for restrictive symmetric NAT networks',
    configured: Boolean(import.meta.env.VITE_TURN_URL),
  },
];
