import * as React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-muted text-muted-foreground border-card-border',
  outline: 'bg-card text-foreground border-card-border',
  destructive: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
} as const;

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof variants }) {
  return (
    <div
      className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', variants[variant], className)}
      {...props}
    />
  );
}
