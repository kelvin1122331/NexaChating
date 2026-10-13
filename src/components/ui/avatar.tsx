import { cn } from '@/lib/utils/cn';

export interface AvatarProps {
  initials: string;
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  imageUrl?: string | null;
  className?: string;
}

const sizeClasses = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-11 w-11 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
};

/** Displays a contact avatar with a deterministic initials fallback and optional presence dot. */
export function Avatar({ initials, name, color = 'from-indigo-300 to-sky-200', size = 'md', online, className }: AvatarProps): JSX.Element {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span aria-label={name} className={cn(
        'inline-flex items-center justify-center rounded-full bg-gradient-to-br font-semibold tracking-tight text-slate-800 ring-1 ring-black/[0.04] dark:text-slate-900',
        color,
        sizeClasses[size],
      )} role="img">
        {initials.slice(0, 2)}
      </span>
      {online ? <span aria-label="Online" className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-emerald-500" /> : null}
    </span>
  );
}
