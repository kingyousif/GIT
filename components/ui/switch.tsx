import * as React from 'react';
import { cn } from '@/lib/utils';

export function Switch({ checked, onCheckedChange, className, disabled }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition',
          checked ? 'translate-x-5' : 'translate-x-1',
        )}
      />
    </button>
  );
}
