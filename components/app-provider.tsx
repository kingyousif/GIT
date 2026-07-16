'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { seedAppData } from '@/lib/seed';
import { getSettings as readSettings } from '@/lib/queries';
import { initStorageCache } from '@/lib/storage';
import { clearSession, getSession, initSession, seedDefaultUsers, setSession } from '@/lib/auth';
import { AppSettings, Role, UserAccount } from '@/lib/types';
import { LocaleProvider } from '@/hooks/use-locale';
import { LocalFolderProvider } from '@/hooks/use-local-folder';

interface AppContextValue {
  initialized: boolean;
  currentUser: UserAccount | null;
  role: Role | null;
  settings: AppSettings | null;
  dataVersion: number;
  login: (user: UserAccount) => void;
  logout: () => void;
  refreshData: () => void;
  refreshSettings: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const init = async () => {
      // Load data from server files into memory cache
      await initStorageCache();
      seedAppData();
      await seedDefaultUsers();
      // Restore session from encrypted cookie
      const session = await initSession();
      setCurrentUser(session);
      setSettings(readSettings());
      setInitialized(true);
    };
    init();
  }, []);

  const role = currentUser?.role ?? null;

  const login = useCallback((user: UserAccount) => {
    setSession(user);
    setCurrentUser(user);
    setDataVersion((prev) => prev + 1);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setDataVersion((prev) => prev + 1);
  }, []);

  const refreshData = useCallback(async () => {
    await initStorageCache(true);
    setSettings(readSettings());
    setDataVersion((prev) => prev + 1);
  }, []);

  const refreshSettings = useCallback(async () => {
    await initStorageCache(true);
    setSettings(readSettings());
    setDataVersion((prev) => prev + 1);
  }, []);

  const value = useMemo(
    () => ({ initialized, currentUser, role, settings, dataVersion, login, logout, refreshData, refreshSettings }),
    [currentUser, dataVersion, initialized, login, logout, refreshData, refreshSettings, role, settings],
  );

  return <AppContext.Provider value={value}><LocaleProvider><LocalFolderProvider>{children}</LocalFolderProvider></LocaleProvider></AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}
