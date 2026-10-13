'use client';

import { useTheme } from 'next-themes';
import { Check, Laptop2, Moon, Sun } from 'lucide-react';
import { SettingsCard, SettingsLayout, SettingsSectionHeading } from '@/components/settings/settings-layout';
import { cn } from '@/lib/utils/cn';

const choices = [
  { id: 'light', title: 'Light', detail: 'Bright and clear, all day long.', icon: Sun, sample: 'bg-white' },
  { id: 'dark', title: 'Dark', detail: 'Easy on the eyes in low light.', icon: Moon, sample: 'bg-slate-900' },
  { id: 'system', title: 'System', detail: 'Follow your device settings.', icon: Laptop2, sample: 'bg-gradient-to-br from-white to-slate-900' },
] as const;

/** Theme selector synced with next-themes and system appearance. */
export default function ThemeSettingsPage(): JSX.Element {
  const { theme, setTheme } = useTheme();
  return (
    <SettingsLayout title="Appearance" description="Set the tone that feels right to you.">
      <SettingsSectionHeading title="Theme" description="NexaChat follows your choice across every conversation." />
      <SettingsCard className="p-3 sm:grid sm:grid-cols-3 sm:gap-3">
        {choices.map(({ id, title, detail, icon: Icon, sample }) => <button key={id} onClick={() => setTheme(id)} aria-pressed={theme === id} className={cn('flex min-h-[100px] items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition sm:block sm:p-3', theme === id ? 'border-brand-200 bg-brand-50/70 dark:border-indigo-900 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800')}><span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', sample, 'border border-line text-slate-700 dark:text-slate-200')}><Icon size={18} /></span><span className="min-w-0 flex-1 sm:mt-3 sm:block"><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[10px] leading-4 text-muted">{detail}</span></span>{theme === id ? <Check size={16} className="text-brand-600 sm:mt-3" /> : <span className="h-4 w-4" />}</button>)}
      </SettingsCard>
      <div className="mt-5 rounded-2xl border border-line bg-panel p-4 text-xs leading-5 text-muted">Your current selection is <span className="font-semibold capitalize text-ink">{theme ?? 'system'}</span>. System mode follows your operating system’s light or dark preference.</div>
    </SettingsLayout>
  );
}
