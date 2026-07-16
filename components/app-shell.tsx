'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Home, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PlusCircle, Settings, Stethoscope, Users2, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppProvider, useAppState } from '@/components/app-provider';
import { LoginScreen } from '@/components/login-screen';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ROLE_META } from '@/lib/constants';
import { Role, UserAccount } from '@/lib/types';
import { useLocale } from '@/hooks/use-locale';
import { useLocalFolder } from '@/hooks/use-local-folder';

type SidebarState = 'expanded' | 'collapsed' | 'hidden';

const SIDEBAR_STORAGE_KEY = 'sidebar-state';

const navigation: { href: string; labelKey: 'dashboard' | 'newPatient' | 'patients' | 'appointments' | 'reports' | 'statistics' | 'settings'; icon: React.ReactNode; roles: Role[] }[] = [
  { href: '/', labelKey: 'dashboard', icon: <Home className="h-4 w-4" />, roles: ['secretary', 'doctor', 'admin'] },
  { href: '/patients/new', labelKey: 'newPatient', icon: <PlusCircle className="h-4 w-4" />, roles: ['secretary', 'admin'] },
  { href: '/patients', labelKey: 'patients', icon: <Users2 className="h-4 w-4" />, roles: ['secretary', 'doctor', 'admin'] },
  { href: '/appointments', labelKey: 'appointments', icon: <CalendarDays className="h-4 w-4" />, roles: ['secretary', 'doctor', 'admin'] },
  { href: '/reports', labelKey: 'reports', icon: <FileText className="h-4 w-4" />, roles: ['doctor', 'admin'] },
  { href: '/statistics', labelKey: 'statistics', icon: <BarChart3 className="h-4 w-4" />, roles: ['admin'] },
  { href: '/settings', labelKey: 'settings', icon: <Settings className="h-4 w-4" />, roles: ['admin'] },
];

function SidebarContent({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const { currentUser, role, settings, logout } = useAppState();
  const { t } = useLocale();

  if (!role || !currentUser) return null;

  return (
    <div className="flex h-full flex-col bg-white text-slate-800 dark:bg-sidebar dark:text-white">
      <div className="border-b border-slate-200 dark:border-white/10 px-3 py-4">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 px-2")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500 dark:text-white/80">{settings?.hospitalName ?? 'Hospital'}</p>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t.nav.giEndoscopyUnit}</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 px-2 py-4">
        {!collapsed && (
          <p className="px-3 text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-white/50">{t.nav.navigation}</p>
        )}
        <nav className="space-y-1">
          {navigation
            .filter((item) => item.roles.includes(role))
            .map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? t.nav[item.labelKey] : undefined}
                  className={cn(
                    'flex items-center rounded-xl text-sm font-medium transition',
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                    active
                      ? 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white',
                  )}
                >
                  {item.icon}
                  {!collapsed && t.nav[item.labelKey]}
                </Link>
              );
            })}
        </nav>
      </div>

      <div className="mt-auto space-y-3 border-t border-slate-200 dark:border-white/10 px-2 py-4">
        {!collapsed && (
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-white/10 dark:text-white">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{currentUser.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-white/60">{ROLE_META[role].label} · @{currentUser.username}</p>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white",
            collapsed ? "justify-center px-2" : "justify-start gap-2",
          )}
          onClick={logout}
          title={collapsed ? t.auth.signOut : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && t.auth.signOut}
        </Button>
      </div>
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { initialized, currentUser, role, settings, login } = useAppState();
  const { t, dir } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sidebarState, setSidebarState] = useState<SidebarState>('expanded');

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY) as SidebarState | null;
    if (stored && (stored === 'expanded' || stored === 'collapsed' || stored === 'hidden')) {
      setSidebarState(stored);
    }
  }, []);

  const cycleSidebar = useCallback(() => {
    setSidebarState((prev) => {
      const next: SidebarState = prev === 'expanded' ? 'collapsed' : prev === 'collapsed' ? 'hidden' : 'expanded';
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const showSidebar = useCallback(() => {
    setSidebarState('expanded');
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'expanded');
  }, []);

  const breadcrumbs = useMemo(() => {
    const clean = pathname.split('/').filter(Boolean);
    if (clean.length === 0) return ['Dashboard'];
    return clean.map((segment) => segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()));
  }, [pathname]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-2xl border border-card-border bg-card px-6 py-4 shadow-soft">{t.loadingWorkstation}</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={(user: UserAccount) => login(user)} />;
  }

  const sidebarWidth = sidebarState === 'expanded' ? 'w-60' : sidebarState === 'collapsed' ? 'w-16' : 'w-0';
  const contentPadding = sidebarState === 'expanded'
    ? (dir === 'rtl' ? 'md:pr-60' : 'md:pl-60')
    : sidebarState === 'collapsed'
      ? (dir === 'rtl' ? 'md:pr-16' : 'md:pl-16')
      : '';

  return (
    <div className="min-h-screen bg-background">
      <aside className={cn(
        "no-print fixed inset-y-0 hidden md:block transition-all duration-300 z-40 overflow-hidden",
        sidebarWidth,
        dir === "rtl" ? "right-0" : "left-0",
      )}>
        <SidebarContent collapsed={sidebarState === 'collapsed'} />
        {sidebarState !== 'hidden' && (
          <button
            onClick={cycleSidebar}
            className={cn(
              "absolute top-3 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-sidebar text-white/70 hover:text-white hover:bg-white/10 transition",
              dir === "rtl" ? "left-1.5" : "right-1.5",
            )}
            title={sidebarState === 'expanded' ? 'Collapse sidebar' : 'Hide sidebar'}
          >
            {dir === 'rtl'
              ? (sidebarState === 'expanded' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
              : (sidebarState === 'expanded' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />)
            }
          </button>
        )}
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="p-0 md:hidden">
          <div className="h-full max-w-xs">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className={cn("transition-all duration-300", contentPadding)}>
        <header className="no-print sticky top-0 z-30 border-b border-[var(--header-border)] bg-[var(--header-bg)] backdrop-blur">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
                  <Menu className="h-4 w-4" />
                </Button>
                {sidebarState === 'hidden' && (
                  <Button variant="outline" size="icon" className="hidden md:inline-flex" onClick={showSidebar}>
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{breadcrumbs.join(' / ')}</p>
                  <h2 className="text-xl font-semibold text-foreground">{settings?.hospitalName}</h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <LanguageToggle />
                <ThemeToggle />
                <Badge variant="secondary" className="gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(), 'PPP')}
                </Badge>
                <Badge>{role ? ROLE_META[role].label : ''}</Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <FolderSelectionBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

function FolderSelectionBanner() {
  const { hasFolder, isSupported, pickFolder, restoreFolder, dirHandle } = useLocalFolder();
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(false);
  const [tryingRestore, setTryingRestore] = useState(false);

  useEffect(() => {
    // Try to restore permission silently on mount
    if (isSupported && !hasFolder) {
      restoreFolder().catch(() => {});
    }
  }, [isSupported, hasFolder, restoreFolder]);

  if (!isSupported || hasFolder || dismissed) return null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{t.media.selectFolderTitle}</p>
          <p className="text-sm text-muted-foreground">{t.media.selectFolderDesc}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              setTryingRestore(true);
              const handle = await pickFolder();
              setTryingRestore(false);
              if (!handle) return;
            }}
            disabled={tryingRestore}
          >
            {t.media.selectFolder}
          </Button>
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            {t.media.skipFolder}
          </Button>
        </div>
      </div>
      {dirHandle && (
        <p className="mt-2 text-xs text-muted-foreground">
          📁 {dirHandle.name}
        </p>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShellInner>{children}</AppShellInner>
    </AppProvider>
  );
}
