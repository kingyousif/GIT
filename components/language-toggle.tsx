'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useLocale } from '@/hooks/use-locale';
import { LOCALE_META, Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const locales: Locale[] = ['en', 'ckb', 'ar'];

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-card-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        aria-label="Change language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{LOCALE_META[locale].flag}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-card-border bg-card shadow-lg">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted',
                  locale === loc && 'bg-primary/10 font-medium text-primary',
                )}
              >
                <span>{LOCALE_META[loc].flag}</span>
                <span>{LOCALE_META[loc].label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
