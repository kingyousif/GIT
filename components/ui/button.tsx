import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  outline: 'border border-card-border bg-card text-foreground hover:bg-muted',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700',
  secondary: 'bg-muted text-foreground hover:opacity-80',
} as const;

type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const sizeVariants: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 py-2 text-sm',
  lg: 'h-11 px-5 text-base',
  icon: 'h-10 w-10',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        sizeVariants[size],
        className,
      )}
      {...props}
    />
  );
});
