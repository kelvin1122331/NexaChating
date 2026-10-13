'use client';

import { Eye, Image as ImageIcon, ReceiptText, ShieldCheck } from 'lucide-react';
import { SettingsCard, SettingsLayout, SettingsSectionHeading, SettingsToggle } from '@/components/settings/settings-layout';
import { useSettingsStore } from '@/stores/settings-store';

/** Privacy controls with clear descriptions of what browser-level protections can and cannot do. */
export default function PrivacySettingsPage(): JSX.Element {
  const privacy = useSettingsStore((state) => state.privacy);
  const updatePrivacy = useSettingsStore((state) => state.updatePrivacy);
  return (
    <SettingsLayout title="Privacy" description="Choose what people can see about you.">
      <div className="space-y-6">
        <section><SettingsSectionHeading title="Who can see" description="Your privacy choices apply to your NexaChat profile." /><SettingsCard>
          <label className="flex min-h-[66px] items-center gap-4 border-b border-line px-4 py-3 md:px-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><Eye size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Last seen and online</span><span className="mt-1 block text-[10px] text-muted">Who can see when you were last active</span></span><select value={privacy.lastSeen} onChange={(event) => updatePrivacy({ lastSeen: event.target.value as typeof privacy.lastSeen })} className="h-9 rounded-lg border border-line bg-panel px-2 text-[11px] outline-none"><option value="everyone">Everyone</option><option value="contacts">Contacts</option><option value="nobody">Nobody</option></select></label>
          <label className="flex min-h-[66px] items-center gap-4 border-b border-line px-4 py-3 md:px-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><ImageIcon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Profile photo</span><span className="mt-1 block text-[10px] text-muted">Who can see your avatar</span></span><select value={privacy.avatarVisibility} onChange={(event) => updatePrivacy({ avatarVisibility: event.target.value as typeof privacy.avatarVisibility })} className="h-9 rounded-lg border border-line bg-panel px-2 text-[11px] outline-none"><option value="everyone">Everyone</option><option value="contacts">Contacts</option><option value="nobody">Nobody</option></select></label>
          <SettingsToggle label="Read receipts" description="Let people know when you’ve read their messages." checked={privacy.readReceipts} onCheckedChange={(readReceipts) => updatePrivacy({ readReceipts })} />
        </SettingsCard></section>
        <section><SettingsSectionHeading title="Extra privacy" description="Reduce accidental sharing on this device." /><SettingsCard>
          <SettingsToggle label="Screenshot protection" description="Disables text selection in the app. Browsers and operating systems may still allow screenshots." checked={privacy.screenshotProtection} onCheckedChange={(screenshotProtection) => updatePrivacy({ screenshotProtection })} />
        </SettingsCard><div className="mt-3 flex items-start gap-2 rounded-2xl bg-emerald-50/70 p-3 text-[10px] leading-5 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-200"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Browser privacy settings are best-effort. Use disappearing messages for sensitive content and never share a verification code.</div></section>
        <section><SettingsSectionHeading title="Messages" description="Controls for message-level privacy." /><SettingsCard><div className="flex min-h-[64px] items-center gap-3 px-4 md:px-5"><ReceiptText size={17} className="text-slate-400" /><div><p className="text-xs font-semibold">Disappearing messages</p><p className="mt-1 text-[10px] text-muted">Manage timers inside conversation details.</p></div></div></SettingsCard></section>
      </div>
    </SettingsLayout>
  );
}
