import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Select({
  className,
  value,
  defaultValue,
  onValueChange,
  children,
  disabled,
}: {
  className?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        className={cn(
          'flex h-10 w-full appearance-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 pr-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        style={{ colorScheme: 'inherit' }}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onValueChange?.(event.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <option
      value={value}
      style={{
        backgroundColor: 'var(--card)',
        color: 'var(--fg)',
      }}
    >
      {children}
    </option>
  );
}
