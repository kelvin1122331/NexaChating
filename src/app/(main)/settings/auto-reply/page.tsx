'use client';

import { useState } from 'react';
import { Bot, Clock3, MessageSquareText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsCard, SettingsLayout, SettingsSectionHeading, SettingsToggle } from '@/components/settings/settings-layout';
import { useSettingsStore } from '@/stores/settings-store';

const weekdays = [{ id: 1, label: 'M' }, { id: 2, label: 'T' }, { id: 3, label: 'W' }, { id: 4, label: 'T' }, { id: 5, label: 'F' }, { id: 6, label: 'S' }, { id: 0, label: 'S' }];

/** Auto-reply rule editor for offline, keyword and business-hours behavior. */
export default function AutoReplySettingsPage(): JSX.Element {
  const autoReply = useSettingsStore((state) => state.autoReply);
  const updateAutoReply = useSettingsStore((state) => state.updateAutoReply);
  const [replyDraft, setReplyDraft] = useState(autoReply.reply);
  const [keywordsDraft, setKeywordsDraft] = useState(autoReply.keywords);

  const toggleDay = (day: number): void => updateAutoReply({ weekdays: autoReply.weekdays.includes(day) ? autoReply.weekdays.filter((item) => item !== day) : [...autoReply.weekdays, day] });
  const save = (): void => {
    if (!replyDraft.trim()) { toast.error('Add a reply message first.'); return; }
    updateAutoReply({ reply: replyDraft.trim(), keywords: keywordsDraft.trim() });
    toast.success('Auto-reply settings saved');
  };

  return (
    <SettingsLayout title="Auto-reply" description="Be there, even when you’re away.">
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-brand-500 to-violet-500 p-5 text-white shadow-lg shadow-indigo-500/10 md:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Bot size={19} /></span><div className="flex-1"><p className="text-sm font-semibold">A little note while you’re away</p><p className="mt-1 text-xs leading-5 text-white/75">Set a gentle expectation and get back when it works for you.</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${autoReply.enabled ? 'bg-emerald-300/20 text-emerald-100' : 'bg-white/10 text-white/70'}`}>{autoReply.enabled ? 'Active' : 'Paused'}</span></div></div>
        <section><SettingsSectionHeading title="Rule" description="Choose when NexaChat should send your saved reply." /><SettingsCard>
          <div className="border-b border-line p-4 md:p-5"><label className="mb-1.5 block text-xs font-medium">Trigger</label><select value={autoReply.triggerType} onChange={(event) => updateAutoReply({ triggerType: event.target.value as typeof autoReply.triggerType })} className="h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none focus:border-brand-300"><option value="offline">When I’m offline</option><option value="all">All incoming messages</option><option value="keyword">When a message contains a keyword</option><option value="outside_hours">Outside business hours</option></select></div>
          {autoReply.triggerType === 'keyword' ? <div className="border-b border-line p-4 md:p-5"><label className="mb-1.5 block text-xs font-medium">Keywords</label><Input value={keywordsDraft} onChange={(event) => setKeywordsDraft(event.target.value)} placeholder="pricing, availability, hello" maxLength={300} /><p className="mt-1.5 text-[10px] text-muted">Separate each keyword with a comma.</p></div> : null}
          {autoReply.triggerType === 'outside_hours' ? <div className="space-y-4 border-b border-line p-4 md:p-5"><div className="grid grid-cols-2 gap-3"><label><span className="mb-1.5 block text-xs font-medium">Start</span><Input type="time" value={autoReply.activeStart} onChange={(event) => updateAutoReply({ activeStart: event.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">End</span><Input type="time" value={autoReply.activeEnd} onChange={(event) => updateAutoReply({ activeEnd: event.target.value })} /></label></div><div><p className="mb-2 text-xs font-medium">Active days</p><div className="flex gap-2">{weekdays.map((day, index) => <button key={`${day.id}-${index}`} type="button" aria-label={`Toggle weekday ${index + 1}`} aria-pressed={autoReply.weekdays.includes(day.id)} onClick={() => toggleDay(day.id)} className={`grid h-9 w-9 place-items-center rounded-full border text-[10px] font-semibold transition ${autoReply.weekdays.includes(day.id) ? 'border-brand-500 bg-brand-500 text-white' : 'border-line text-muted'}`}>{day.label}</button>)}</div></div></div> : null}
          <div className="flex items-center gap-3 p-4 md:px-5"><Clock3 size={16} className="text-slate-400" /><label htmlFor="cooldown" className="flex-1 text-xs font-medium">Cooldown between replies</label><select id="cooldown" value={autoReply.cooldownMinutes} onChange={(event) => updateAutoReply({ cooldownMinutes: Number(event.target.value) })} className="h-9 rounded-lg border border-line bg-panel px-2 text-[11px]"><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 hour</option><option value={240}>4 hours</option></select></div>
        </SettingsCard></section>
        <section><SettingsSectionHeading title="Your reply" description="Keep it warm, clear, and true to your voice." /><SettingsCard className="p-4 md:p-5"><div className="flex items-center gap-2 text-xs font-semibold"><MessageSquareText size={15} className="text-brand-600" /> Message</div><textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} rows={4} maxLength={1_000} className="mt-3 w-full resize-y rounded-xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10" /><div className="flex items-center justify-between"><span className="text-[10px] text-muted">{replyDraft.length}/1000</span><span className="text-[10px] text-muted">Sent once per person during your cooldown.</span></div></SettingsCard></section>
        <SettingsCard><SettingsToggle label="Turn on auto-reply" description="Your saved rule will apply to new messages." checked={autoReply.enabled} onCheckedChange={(enabled) => updateAutoReply({ enabled })} /></SettingsCard>
        <Button onClick={save}><Save size={15} /> Save changes</Button>
      </div>
    </SettingsLayout>
  );
}
