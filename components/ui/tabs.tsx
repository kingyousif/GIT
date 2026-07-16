'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const activeValue = value ?? internalValue;
  const setValue = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue }}>
      <div className={cn('flex flex-col gap-4', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('inline-flex w-full flex-wrap gap-2 rounded-2xl bg-muted p-1.5', className)} {...props} />;
}

export function TabsTrigger({
  value,
  className,
  children,
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        'rounded-xl px-4 py-2 text-sm font-medium transition',
        context.value === value
          ? 'bg-card text-primary shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');
  if (context.value !== value) return null;
  return <div className={cn('outline-none', className)}>{children}</div>;
}
