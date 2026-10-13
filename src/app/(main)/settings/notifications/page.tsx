'use client';

import { useState } from 'react';
import { BellRing, Check, Smartphone, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SettingsCard, SettingsLayout, SettingsSectionHeading, SettingsToggle } from '@/components/settings/settings-layout';
import { useSettingsStore } from '@/stores/settings-store';

/** Notification preferences for message categories, sound, previews and device permission. */
export default function NotificationSettingsPage(): JSX.Element {
  const notifications = useSettingsStore((state) => state.notifications);
  const updateNotifications = useSettingsStore((state) => state.updateNotifications);
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  const requestPermission = async (): Promise<void> => {
    if (typeof Notification === 'undefined') { toast.error('This browser does not support notifications.'); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') toast.success('Notifications enabled on this device');
    else toast('You can change notification access in your browser settings.');
  };

  return (
    <SettingsLayout title="Notifications" description="Choose the moments you want to hear about.">
      <div className="space-y-6">
        <section><SettingsSectionHeading title="Push notifications" description="Fine-tune which conversations can reach you." /><SettingsCard>
          <SettingsToggle label="Direct messages" description="Notifications from one-to-one conversations." checked={notifications.messages} onCheckedChange={(messages) => updateNotifications({ messages })} />
          <SettingsToggle label="Groups" description="Mentions and new messages in group chats." checked={notifications.groups} onCheckedChange={(groups) => updateNotifications({ groups })} />
          <SettingsToggle label="Channels" description="Updates from channels you follow." checked={notifications.channels} onCheckedChange={(channels) => updateNotifications({ channels })} />
        </SettingsCard></section>
        <section><SettingsSectionHeading title="On this device" description="Control how notifications appear here." /><SettingsCard>
          <SettingsToggle label="Notification sounds" description="Play a soft sound when a new message arrives." checked={notifications.sound} onCheckedChange={(sound) => updateNotifications({ sound })} />
          <SettingsToggle label="Show message previews" description="Display the message text in notification banners." checked={notifications.preview} onCheckedChange={(preview) => updateNotifications({ preview })} />
        </SettingsCard></section>
        <div className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-4 sm:flex-row sm:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><Smartphone size={17} /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Browser permission</p><p className="mt-1 text-[10px] text-muted">Current status: <span className="font-semibold capitalize">{permission}</span></p></div>{permission !== 'granted' ? <Button size="sm" variant="outline" onClick={() => void requestPermission()}><BellRing size={14} /> Enable notifications</Button> : <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><Check size={14} /> Enabled</span>}</div>
        <p className="flex items-center gap-2 px-1 text-[10px] text-muted"><Volume2 size={13} />Push notifications require a connected Supabase account and push provider.</p>
      </div>
    </SettingsLayout>
  );
}
