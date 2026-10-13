'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, BellRing, CircleUserRound, FolderHeart, HardDrive, LockKeyhole,
  LogOut, MessageSquareText, MoonStar, Settings2, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SettingsLayout, SettingsCard } from '@/components/settings/settings-layout';
import { useChatStore } from '@/stores/chat-store';
import { offlineDatabase } from '@/lib/offline/db';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const settingsLinks = [
  { href: '/settings/profile', title: 'Profile', description: 'Name, username, photo, and status', icon: CircleUserRound, tint: 'indigo' },
  { href: '/settings/privacy', title: 'Privacy', description: 'Choose what people can see', icon: LockKeyhole, tint: 'emerald' },
  { href: '/settings/notifications', title: 'Notifications', description: 'Manage sounds and message alerts', icon: BellRing, tint: 'amber' },
  { href: '/settings/chat-folders', title: 'Chat folders', description: 'Keep your conversations in flow', icon: FolderHeart, tint: 'violet' },
  { href: '/settings/auto-reply', title: 'Auto-reply', description: 'Send a thoughtful reply while away', icon: MessageSquareText, tint: 'sky' },
  { href: '/settings/theme', title: 'Appearance', description: 'Light, dark, or follow your system', icon: MoonStar, tint: 'rose' },
] as const;

const iconTones = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
};

/** Settings hub and account profile summary. */
export default function SettingsPage(): JSX.Element {
  const user = useChatStore((state) => state.user);
  const router = useRouter();
  const [storageLabel, setStorageLabel] = useState('Checking…');

  useEffect(() => {
    let active = true;
    void navigator.storage?.estimate().then((estimate) => {
      if (!active) return;
      const used = estimate.usage ?? 0;
      setStorageLabel(used < 1_048_576 ? `${Math.round(used / 1_024)} KB used` : `${(used / 1_048_576).toFixed(1)} MB used`);
    }).catch(() => { if (active) setStorageLabel('Available offline'); });
    return () => { active = false; };
  }, []);

  const clearCache = async (): Promise<void> => {
    try {
      const database = offlineDatabase;
      if (database) await database.transaction('rw', database.tables, async () => {
        await Promise.all(database.tables.map((table) => table.clear()));
      });
      toast.success('Offline cache cleared');
      setStorageLabel('0 KB used');
    } catch {
      toast.error('Could not clear local cache.');
    }
  };

  const logout = async (): Promise<void> => {
    const client = getSupabaseBrowserClient();
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) { toast.error('Could not sign out. Please try again.'); return; }
    }
    toast.success('You’re signed out of this session');
    router.push('/login');
  };

  return (
    <SettingsLayout title="Settings" description="Make NexaChat feel like yours.">
      <div className="flex flex-col gap-5">
        <Link href="/settings/profile" className="group flex items-center gap-4 rounded-3xl border border-line bg-panel p-4 shadow-card transition hover:border-brand-200 md:p-5"><Avatar name={user.displayName} initials={user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)} size="lg" color="from-indigo-300 to-violet-200" online /><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-sm font-semibold">{user.displayName}<ShieldCheck size={14} className="text-brand-500" /></span><span className="mt-1 block text-xs text-muted">@{user.username}</span></span><ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" /></Link>

        <div className="grid gap-3 sm:grid-cols-2">{settingsLinks.map(({ href, title, description, icon: Icon, tint }) => <Link href={href} key={href} className="group flex min-h-[82px] items-center gap-3 rounded-2xl border border-line bg-panel p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconTones[tint]}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[10px] leading-4 text-muted">{description}</span></span><ArrowRight size={14} className="text-slate-300 transition group-hover:text-brand-500" /></Link>)}</div>

        <div><h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[.13em] text-slate-400">App</h2><SettingsCard>
          <button onClick={() => void clearCache()} className="flex min-h-[68px] w-full items-center gap-3 px-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 md:px-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800"><HardDrive size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Storage and data</span><span className="mt-1 block text-[10px] text-muted">{storageLabel} · Clear offline cache</span></span><ArrowRight size={15} className="text-slate-300" /></button>
          <button onClick={() => toast('Your profile is ready to manage. Use Delete account when account services are configured.')} className="flex min-h-[68px] w-full items-center gap-3 border-t border-line px-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 md:px-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"><Settings2 size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Account and security</span><span className="mt-1 block text-[10px] text-muted">Manage account access and data</span></span><ArrowRight size={15} className="text-slate-300" /></button>
        </SettingsCard></div>

        <div className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3"><span className="text-[10px] text-muted">NexaChat · Version 1.0.0</span><Button variant="ghost" size="sm" onClick={() => void logout()}><LogOut size={14} /> Sign out</Button></div>
      </div>
    </SettingsLayout>
  );
}
