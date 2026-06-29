'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { SonexUser, SonexRole } from './sonexTypes';
import { supabase } from './supabaseClient';

interface SonexAuthContextType {
  user: SonexUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: SonexUser; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCarrier: boolean;
}

const SonexAuthContext = createContext<SonexAuthContextType>({
  user: null,
  login: async () => ({ success: false }),
  logout: async () => {},
  isAuthenticated: false,
  isAdmin: false,
  isCarrier: false,
});

export function SonexAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SonexUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      if (data) {
        const mappedUser: SonexUser = {
          id: data.id,
          email: data.email,
          role: data.role as SonexRole,
          displayName: data.display_name,
          carrierId: data.carrier_id || undefined,
          avatar: data.avatar || 'NU',
        };
        setUser(mappedUser);
        return mappedUser;
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
    return null;
  };

  useEffect(() => {
    // 1. Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: SonexUser; error?: string }> => {
    const { data: { user: authUser }, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !authUser) {
      return { success: false, error: authError?.message || 'Invalid email or password.' };
    }

    const mapped = await fetchProfile(authUser.id);
    if (!mapped) {
      return { success: false, error: 'User profile not found in database.' };
    }

    return { success: true, user: mapped };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <SonexAuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isCarrier: user?.role === 'carrier',
    }}>
      {!loading && children}
    </SonexAuthContext.Provider>
  );
}

export function useSonexAuth() {
  return useContext(SonexAuthContext);
}
