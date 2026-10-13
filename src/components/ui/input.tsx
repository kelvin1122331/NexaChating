import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
}

/** Styled input with an optional leading icon and accessible focus ring. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, leadingIcon, ...props }, ref) => (
  <span className="relative block">
    {leadingIcon ? <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{leadingIcon}</span> : null}
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60',
        leadingIcon && 'pl-10',
        className,
      )}
      {...props}
    />
  </span>
));
Input.displayName = 'Input';
