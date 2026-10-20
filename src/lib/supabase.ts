import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getStoredUrl(): string {
  try {
    const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    if (envUrl && envUrl.startsWith('http') && envUrl !== 'MY_SUPABASE_URL') {
      return envUrl;
    }
    const saved = localStorage.getItem('yumi_supabase_url')?.trim();
    if (saved && saved.startsWith('http')) return saved;
  } catch {
    // Ignore
  }
  return '';
}

function getStoredKey(): string {
  try {
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (envKey && envKey.length > 10 && envKey !== 'MY_SUPABASE_ANON_KEY') {
      return envKey;
    }
    const saved = localStorage.getItem('yumi_supabase_anon_key')?.trim();
    if (saved && saved.length > 10) return saved;
  } catch {
    // Ignore
  }
  return '';
}

let activeClient: SupabaseClient | null = null;
let currentUrl = getStoredUrl();
let currentKey = getStoredKey();

function initClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key || !url.startsWith('http')) return null;
  try {
    return createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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
