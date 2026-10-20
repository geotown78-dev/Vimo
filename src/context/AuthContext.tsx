import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured, setSupabaseCredentials } from '../lib/supabase';

export interface AuthProfile {
  displayName: string;
  email: string;
  initials: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateKeys: (url: string, anonKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to persist user record into Supabase database (public.profiles or public.users)
async function syncProfileToDatabase(client: any, u: User, preferredName?: string) {
  if (!u || !client) return;
  try {
    const metaName = u.user_metadata?.display_name || u.user_metadata?.full_name || '';
    const name = preferredName?.trim() || metaName.trim() || u.email?.split('@')[0] || 'User';

    // 1. Primary table: public.profiles
    const { error } = await client
      .from('profiles')
      .upsert(
        {
          id: u.id,
          email: u.email,
          display_name: name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.warn('[Supabase DB] profiles table note:', error.message);
      // 2. Fallback table: public.users
      await client
        .from('users')
        .upsert(
          {
            id: u.id,
            email: u.email,
            display_name: name,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .catch(() => {});
    }
  } catch (err) {
    console.warn('[Supabase DB] Profile sync exception:', err);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [configured, setConfigured] = useState<boolean>(isSupabaseConfigured());

  const computeProfile = useCallback((u: User | null, customName?: string): AuthProfile | null => {
    if (!u) return null;
    const email = u.email || '';
    const metaName = u.user_metadata?.display_name || u.user_metadata?.full_name || '';
    const name = customName?.trim() || metaName.trim() || email.split('@')[0] || 'User';
    const initials = name.slice(0, 2).toUpperCase();
    return {
      displayName: name,
      email,
      initials,
    };
  }, []);

  // Listen to auth state changes and fetch database records
  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      setConfigured(false);
      return;
    }

    setConfigured(true);

    client.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setProfile(computeProfile(currentUser));

        // Attempt to fetch saved profile from public.profiles
        try {
          const { data } = await client
            .from('profiles')
            .select('display_name')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (data?.display_name) {
            setProfile(computeProfile(currentUser, data.display_name));
          } else {
            // Persist initial record
            syncProfileToDatabase(client, currentUser);
          }
        } catch {
          // Ignore
        }
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setProfile(computeProfile(currentUser));
        syncProfileToDatabase(client, currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [computeProfile, configured]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const client = getSupabase();
    if (!client) {
      return { error: 'Supabase URL and Anon Key are required.' };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }

      setSession(data.session);
      setUser(data.user);
      setProfile(computeProfile(data.user));

      // Persist / update record in public.profiles table
      await syncProfileToDatabase(client, data.user);

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'An unexpected error occurred during sign in.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<{ error: string | null }> => {
    const client = getSupabase();
    if (!client) {
      return { error: 'Supabase URL and Anon Key are required.' };
    }

    try {
      const cleanName = displayName.trim() || email.split('@')[0];
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: cleanName,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setProfile(computeProfile(data.user, cleanName));

        // Immediately save user record into public.profiles table
        await syncProfileToDatabase(client, data.user, cleanName);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'An unexpected error occurred during registration.' };
    }
  };

  const signOut = async () => {
    const client = getSupabase();
    if (client) {
      try {
        await client.auth.signOut();
      } catch {
        // Ignore
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateKeys = (url: string, anonKey: string): boolean => {
    const success = setSupabaseCredentials(url, anonKey);
    setConfigured(success);
    return success;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isConfigured: configured,
        signIn,
        signUp,
        signOut,
        updateKeys,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
