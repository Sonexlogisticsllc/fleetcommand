'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type PortalRole = 'dispatcher' | 'owner' | 'sales';

interface User {
  username: string;
  role: PortalRole;
  displayName: string;
  avatar: string; // initials
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, role: PortalRole) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

// ─── Mock Credentials ─────────────────────────────────────────────────────────
const CREDENTIALS: Record<PortalRole, { username: string; password: string; displayName: string }> = {
  dispatcher: { username: 'dispatcher', password: 'dispatch2026', displayName: 'Alex Carter' },
  owner:      { username: 'owner',      password: 'fleet2026',    displayName: 'Fleet Owner' },
  sales:      { username: 'sales',      password: 'sales2026',    displayName: 'Sales Team' },
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  logout: () => {},
  isAuthenticated: false,
});

const SESSION_KEY = 'fc_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const login = (username: string, password: string, role: PortalRole): boolean => {
    const creds = CREDENTIALS[role];
    if (
      username.trim().toLowerCase() === creds.username &&
      password === creds.password
    ) {
      const u: User = {
        username: creds.username,
        role,
        displayName: creds.displayName,
        avatar: creds.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      };
      setUser(u);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
