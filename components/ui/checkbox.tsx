import * as React from 'react';
import { cn } from '@/lib/utils';

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Checkbox(
  { className, ...props },
  ref,
) {
  return <input ref={ref} type="checkbox" className={cn('h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary', className)} {...props} />;
});
