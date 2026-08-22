'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { SonexUser } from './sonexTypes';
import { loginAction, logoutAction, getCurrentUserAction } from './authActions';

interface SonexAuthContextType {
  user: SonexUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: SonexUser; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMcOwner: boolean;
  isCarrier: boolean;
}

const SonexAuthContext = createContext<SonexAuthContextType>({
  user: null,
  login: async () => ({ success: false }),
  logout: async () => {},
  isAuthenticated: false,
  isAdmin: false,
  isMcOwner: false,
  isCarrier: false,
});

export function SonexAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SonexUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate session on component mount
    getCurrentUserAction()
      .then((currUser) => {
        setUser(currUser);
      })
      .catch((err) => {
        console.error('Error fetching current user:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: SonexUser; error?: string }> => {
    const res = await loginAction(email, password);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const logout = async () => {
    await logoutAction();
    setUser(null);
  };

  return (
    <SonexAuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isMcOwner: user?.role === 'mc_owner',
      isCarrier: user?.role === 'carrier',
    }}>
      {!loading && children}
    </SonexAuthContext.Provider>
  );
}

export function useSonexAuth() {
  return useContext(SonexAuthContext);
}
