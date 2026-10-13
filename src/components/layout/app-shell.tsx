'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot, CheckSquare, ContactRound, MessageCircle, Settings2, WalletCards,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Avatar } from '@/components/ui/avatar';
import { ChatListPanel } from '@/components/chat/chat-list-panel';
import { OfflineBanner } from '@/components/layout/offline-banner';
import { useChatStore } from '@/stores/chat-store';

const navItems = [
  { href: '/chat', label: 'Chats', icon: MessageCircle },
  { href: '/contacts', label: 'Contacts', icon: ContactRound },
  { href: '/ai-assistant', label: 'Nexa AI', icon: Bot },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/wallet', label: 'Wallet', icon: WalletCards },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/chat') return pathname.startsWith('/chat');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Responsive shell: desktop navigation and inbox rail, with a compact mobile tab bar. */
export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const user = useChatStore((state) => state.user);
  const isChatRoute = pathname.startsWith('/chat');
  const isRoomRoute = /^\/chat\/[^/]+$/.test(pathname) && pathname !== '/chat/new';
  const isNewRoute = pathname === '/chat/new';

  return (
    <div className="h-[100dvh] overflow-hidden bg-canvas text-ink">
      <OfflineBanner />
      <div className="flex h-full min-w-0">
        <aside className="hidden h-full w-[76px] shrink-0 flex-col items-center border-r border-line bg-panel py-5 md:flex" aria-label="Main navigation">
          <Link href="/chat" aria-label="NexaChat home" className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20 transition hover:scale-105">
            <MessageCircle size={21} strokeWidth={2.4} />
          </Link>
          <nav className="mt-9 flex flex-1 flex-col items-center gap-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link key={href} href={href} aria-label={label} aria-current={active ? 'page' : undefined} title={label}
                  className={cn('group relative grid h-11 w-11 place-items-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200', active && 'bg-brand-50 text-brand-600 hover:bg-brand-50 hover:text-brand-600 dark:bg-indigo-950/60 dark:text-indigo-300')}>
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  {active ? <span className="absolute -left-[17px] h-6 w-[3px] rounded-r-full bg-brand-500" /> : null}
                  <span className="pointer-events-none absolute left-[58px] z-50 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg group-hover:block">{label}</span>
                </Link>
              );
            })}
          </nav>
          <Link href="/settings/profile" className="rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-brand-200" aria-label="Profile settings">
            <Avatar name={user.displayName} initials="AM" size="md" color="from-indigo-300 to-violet-200" />
          </Link>
        </aside>

        {isChatRoute ? (
          <section className={cn(
            'h-full w-full shrink-0 border-r border-line bg-panel md:flex md:w-[360px] xl:w-[388px]',
            isRoomRoute && 'hidden',
            isNewRoute && 'hidden md:flex',
          )} aria-label="Chats">
            <ChatListPanel />
          </section>
        ) : null}

        <main className={cn(
          'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          isChatRoute && !isRoomRoute && !isNewRoute && 'hidden md:flex',
          isNewRoute && 'flex',
          !isRoomRoute && 'pb-[calc(70px+var(--safe-bottom))] md:pb-0',
        )}>
          {children}
        </main>
      </div>

      {!isRoomRoute ? (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex h-[calc(66px+var(--safe-bottom))] items-start justify-around border-t border-line bg-panel/95 px-1 pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
          {navItems.filter((item) => item.href !== '/wallet').map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors', active && 'text-brand-600 dark:text-indigo-300')}>
                <span className={cn('grid h-8 w-10 place-items-center rounded-xl transition-colors', active && 'bg-brand-50 dark:bg-indigo-950/60')}><Icon size={18} strokeWidth={active ? 2.2 : 1.8} /></span>
                <span>{label === 'Nexa AI' ? 'AI' : label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
