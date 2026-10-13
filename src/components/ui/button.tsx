import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonStyles = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:transition-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
        secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-slate-800 dark:text-indigo-200 dark:hover:bg-slate-700',
        outline: 'border border-line bg-panel text-ink hover:bg-slate-50 dark:hover:bg-slate-800',
        ghost: 'text-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
        danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300',
      },
      size: {
        default: 'px-4 py-2.5',
        sm: 'min-h-9 rounded-lg px-3 text-xs',
        icon: 'h-11 w-11 p-0',
        lg: 'min-h-12 rounded-2xl px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  loading?: boolean;
}

/** Accessible, consistently sized action button used throughout NexaChat. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
    <button ref={ref} className={cn(buttonStyles({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { buttonStyles };
