'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { SonexUser, SonexRole } from './sonexTypes';
import { getCarriers } from './sonexStore';

interface SonexAuthContextType {
  user: SonexUser | null;
  login: (email: string, password: string) => { success: boolean; user?: SonexUser; error?: string };
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCarrier: boolean;
}

const SonexAuthContext = createContext<SonexAuthContextType>({
  user: null,
  login: () => ({ success: false }),
  logout: () => {},
  isAuthenticated: false,
  isAdmin: false,
  isCarrier: false,
});

const SESSION_KEY = 'sonex_auth_user_v1';

// Admin credentials (hardcoded for mock phase; will be Supabase Auth in Phase 2)
const ADMIN_CREDENTIALS = {
  email: 'dispatch@sonexlogistics.com',
  password: 'sonex2026',
  user: {
    id: 'admin-1',
    email: 'dispatch@sonexlogistics.com',
    role: 'admin' as SonexRole,
    displayName: 'Sonex Dispatch',
    avatar: 'SD',
  },
};

export function SonexAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SonexUser | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const login = (email: string, password: string): { success: boolean; user?: SonexUser; error?: string } => {
    // Check admin
    if (
      email.trim().toLowerCase() === ADMIN_CREDENTIALS.email &&
      password === ADMIN_CREDENTIALS.password
    ) {
      const u = ADMIN_CREDENTIALS.user;
      setUser(u);
      localStorage.setItem(SESSION_KEY, JSON.stringify(u));
      return { success: true, user: u };
    }

    // Check carrier portal credentials
    try {
      const carriers = getCarriers();
      const carrier = carriers.find(
        c => c.portalEmail.toLowerCase() === email.trim().toLowerCase() &&
             c.portalPassword === password
      );
      if (carrier) {
        const u: SonexUser = {
          id: carrier.id,
          email: carrier.portalEmail,
          role: 'carrier',
          displayName: `${carrier.firstName} ${carrier.lastName}`,
          carrierId: carrier.id,
          avatar: `${carrier.firstName[0]}${carrier.lastName[0]}`.toUpperCase(),
        };
        setUser(u);
        localStorage.setItem(SESSION_KEY, JSON.stringify(u));
        return { success: true, user: u };
      }
    } catch { /* ignore */ }

    return { success: false, error: 'Invalid email or password.' };
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
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
      {children}
    </SonexAuthContext.Provider>
  );
}

export function useSonexAuth() {
  return useContext(SonexAuthContext);
}
