import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured, setSupabaseCredentials } from '../lib/supabase';

interface AuthProfile {
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [configured, setConfigured] = useState<boolean>(isSupabaseConfigured());

  const computeProfile = useCallback((u: User | null): AuthProfile | null => {
    if (!u) return null;
    const email = u.email || '';
    const metaName = u.user_metadata?.display_name || u.user_metadata?.full_name || '';
    const name = metaName.trim() || email.split('@')[0] || 'User';
    const initials = name.slice(0, 2).toUpperCase();
    return {
      displayName: name,
      email,
      initials,
    };
  }, []);

  // Listen to auth state changes from Supabase
  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      setConfigured(false);
      return;
    }

    setConfigured(true);

    client.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      setProfile(computeProfile(currentUser));
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);
      setProfile(computeProfile(currentUser));
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
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setProfile(computeProfile(data.user));
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
