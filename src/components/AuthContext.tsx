'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface AuthState {
  // Admin auth
  isAdmin: boolean;
  adminName: string;
  adminRole: 'super_admin' | 'admin' | 'viewer' | '';
  adminLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => void;

  // Company user auth
  companyAuth: Record<string, {
    companyId: string;
    companyName: string;
    username: string;
    displayName: string;
    token: string;
  }>;
  companyLogin: (companyId: string, username: string, password: string) => Promise<{ success: boolean; error?: string; data?: any }>;
  companyLogout: (companyId: string) => void;
  getCompanyAuth: (companyId: string) => { isLoggedIn: boolean; displayName: string; companyName: string };
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminRole, setAdminRole] = useState<'super_admin' | 'admin' | 'viewer' | ''>('');
  const [companyAuth, setCompanyAuth] = useState<AuthState['companyAuth']>({});

  // Restore from sessionStorage on mount
  useEffect(() => {
    // Admin
    const adminSaved = sessionStorage.getItem('admin_auth');
    if (adminSaved) {
      try {
        const parsed = JSON.parse(adminSaved);
        if (parsed.loggedIn) {
          setIsAdmin(true);
          setAdminName(parsed.name || 'Admin');
          setAdminRole(parsed.role || 'admin');
        }
      } catch {
        if (adminSaved === 'true') {
          setIsAdmin(true);
          setAdminName('Admin');
          setAdminRole('admin');
        }
      }
    }

    // Company auths — scan sessionStorage for auth_* keys
    const auths: AuthState['companyAuth'] = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('auth_')) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key)!);
          if (data.companyId) {
            auths[data.companyId] = {
              companyId: data.companyId,
              companyName: data.companyName,
              username: data.username || '',
              displayName: data.displayName || data.companyName,
              token: data.token,
            };
          }
        } catch { /* ignore */ }
      }
    }
    if (Object.keys(auths).length > 0) {
      setCompanyAuth(auths);
    }
  }, []);

  const adminLogin = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setAdminName(data.adminName || 'Admin');
        setAdminRole(data.role || 'admin');
        sessionStorage.setItem('admin_auth', JSON.stringify({
          loggedIn: true,
          name: data.adminName || 'Admin',
          role: data.role || 'admin',
        }));
        return { success: true };
      }
      return { success: false, error: data.error || 'รหัสผ่านไม่ถูกต้อง' };
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาด' };
    }
  }, []);

  const adminLogout = useCallback(() => {
    setIsAdmin(false);
    setAdminName('');
    setAdminRole('');
    sessionStorage.removeItem('admin_auth');
  }, []);

  const companyLogin = useCallback(async (companyId: string, username: string, password: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, username, password }),
      });
      const data = await res.json();
      if (data.success) {
        const entry = {
          companyId: data.companyId,
          companyName: data.companyName,
          username: data.username || '',
          displayName: data.displayName || data.companyName,
          token: data.token,
        };
        setCompanyAuth(prev => ({ ...prev, [companyId]: entry }));
        sessionStorage.setItem(`auth_${companyId}`, JSON.stringify(data));
        return { success: true, data };
      }
      return { success: false, error: data.error || 'รหัสผ่านไม่ถูกต้อง' };
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาด' };
    }
  }, []);

  const companyLogout = useCallback((companyId: string) => {
    setCompanyAuth(prev => {
      const next = { ...prev };
      delete next[companyId];
      return next;
    });
    sessionStorage.removeItem(`auth_${companyId}`);
  }, []);

  const getCompanyAuth = useCallback((companyId: string) => {
    const auth = companyAuth[companyId];
    return {
      isLoggedIn: !!auth,
      displayName: auth?.displayName || '',
      companyName: auth?.companyName || '',
    };
  }, [companyAuth]);

  return (
    <AuthContext.Provider value={{
      isAdmin, adminName, adminRole,
      adminLogin, adminLogout,
      companyAuth, companyLogin, companyLogout, getCompanyAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
