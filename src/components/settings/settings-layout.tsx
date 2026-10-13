'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft, BellRing, ChevronRight, CircleUserRound, FolderHeart, LockKeyhole,
  MessageSquareText, MoonStar, Settings2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

const sections = [
  { href: '/settings/profile', title: 'Profile', icon: CircleUserRound },
  { href: '/settings/privacy', title: 'Privacy', icon: LockKeyhole },
  { href: '/settings/notifications', title: 'Notifications', icon: BellRing },
  { href: '/settings/chat-folders', title: 'Chat folders', icon: FolderHeart },
  { href: '/settings/auto-reply', title: 'Auto-reply', icon: MessageSquareText },
  { href: '/settings/theme', title: 'Appearance', icon: MoonStar },
];

/** Settings page frame with a keyboard-friendly settings index and mobile back affordance. */
export function SettingsLayout({ title, description, children }: { title: string; description: string; children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const root = pathname === '/settings';
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex min-h-[76px] shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-3 md:px-8"><Link href={root ? '/chat' : '/settings'} aria-label={root ? 'Back to chats' : 'Back to settings'} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={19} /></Link><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><Settings2 size={18} /></span><div><h1 className="text-base font-semibold">{title}</h1><p className="mt-0.5 text-[11px] text-muted">{description}</p></div></header>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:flex-row md:px-8 md:py-8">
          {!root ? <nav className="scrollbar-none -mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:block md:w-[210px] md:space-y-1 md:overflow-visible md:px-0" aria-label="Settings sections">
            {sections.map(({ href, title: itemTitle, icon: Icon }) => {
              const active = pathname === href;
              return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium text-slate-500 transition hover:bg-panel hover:text-ink md:w-full', active && 'bg-brand-50 text-brand-700 dark:bg-indigo-950/50 dark:text-indigo-200')}><Icon size={15} /><span>{itemTitle}</span><ChevronRight size={13} className="ml-auto hidden md:block" /></Link>;
            })}
          </nav> : null}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={cn('overflow-hidden rounded-3xl border border-line bg-panel shadow-card', className)}>{children}</div>;
}

export function SettingsToggle({ label, description, checked, onCheckedChange }: { label: string; description?: string; checked: boolean; onCheckedChange: (checked: boolean) => void }): JSX.Element {
  return (
    <div className="flex min-h-[66px] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 md:px-5">
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{label}</p>{description ? <p className="mt-1 text-[10px] leading-4 text-muted">{description}</p> : null}</div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2', checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700')}><span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} /></button>
    </div>
  );
}

export function SettingsSectionHeading({ title, description }: { title: string; description: string }): JSX.Element {
  return <div className="mb-4"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div>;
}
