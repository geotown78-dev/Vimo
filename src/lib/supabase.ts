import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'http://supabasekong-o13hsliyqabiynbvsurm3t1c.5.83.153.142.sslip.io';

export function getStoredUrl(): string {
  try {
    const saved = localStorage.getItem('yumi_supabase_url')?.trim();
    if (saved && saved.startsWith('http')) return saved;
    const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    if (envUrl && envUrl.startsWith('http') && envUrl !== 'MY_SUPABASE_URL') {
      return envUrl;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_SUPABASE_URL;
}

export function getStoredKey(): string {
  try {
    const saved = localStorage.getItem('yumi_supabase_anon_key')?.trim();
    if (saved && saved.length > 10) return saved;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (envKey && envKey.length > 10 && envKey !== 'MY_SUPABASE_ANON_KEY') {
      return envKey;
    }
  } catch {
    // Ignore
  }
  return '';
}

function resolveClientUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  // When running on HTTPS (e.g. https://yumi.ge/) and the target Supabase URL is HTTP,
  // route via same-origin reverse-proxy to avoid browser Mixed-Content blocking!
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    rawUrl.startsWith('http://')
  ) {
    return `${window.location.origin}/api/supabase-proxy`;
  }
  return rawUrl;
}

let activeClient: SupabaseClient | null = null;
let currentUrl = getStoredUrl();
let currentKey = getStoredKey();

function initClient(rawUrl: string, key: string): SupabaseClient | null {
  if (!rawUrl || !key) return null;
  const clientUrl = resolveClientUrl(rawUrl);

  try {
    return createClient(clientUrl, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-supabase-target-url': rawUrl,
        },
      },
    });
  } catch (err) {
    console.error('[Supabase] initialization error:', err);
    return null;
  }
}

activeClient = initClient(currentUrl, currentKey);

export function isSupabaseConfigured(): boolean {
  return Boolean(currentUrl && currentKey && activeClient);
}

export function getSupabase(): SupabaseClient | null {
  if (!activeClient) {
    currentUrl = getStoredUrl();
    currentKey = getStoredKey();
    activeClient = initClient(currentUrl, currentKey);
  }
  return activeClient;
}

export function setSupabaseCredentials(url: string, anonKey: string): boolean {
  try {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();
    if (!cleanUrl || !cleanKey) return false;

    localStorage.setItem('yumi_supabase_url', cleanUrl);
    localStorage.setItem('yumi_supabase_anon_key', cleanKey);
    currentUrl = cleanUrl;
    currentKey = cleanKey;
    activeClient = initClient(cleanUrl, cleanKey);
    return Boolean(activeClient);
  } catch {
    return false;
  }
}

export const supabase = activeClient;
