'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Camera, Check, ImagePlus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsLayout, SettingsCard } from '@/components/settings/settings-layout';
import { useChatStore } from '@/stores/chat-store';
import { compressImage } from '@/lib/storage/compress';

const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Use at least 2 characters.').max(100),
  username: z.string().trim().min(3, 'Use at least 3 characters.').max(50).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores are allowed.'),
  bio: z.string().max(500),
  statusText: z.string().max(150),
});
type ProfileValues = z.infer<typeof profileSchema>;

/** Validated editor for the local NexaChat profile and avatar. */
export default function ProfileSettingsPage(): JSX.Element {
  const user = useChatStore((state) => state.user);
  const updateProfile = useChatStore((state) => state.updateProfile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { displayName: user.displayName, username: user.username, bio: user.bio, statusText: user.statusText } });
  const bio = useWatch({ control: form.control, name: 'bio' });

  useEffect(() => { form.reset({ displayName: user.displayName, username: user.username, bio: user.bio, statusText: user.statusText }); }, [form, user]);

  const uploadAvatar = async (file?: File): Promise<void> => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { toast.error('Choose an image under 10 MB.'); return; }
    setSavingAvatar(true);
    try {
      const compressed = await compressImage(file, 512, 0.82);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') updateProfile({ avatarUrl: reader.result });
        setSavingAvatar(false);
        toast.success('Profile photo updated');
      };
      reader.onerror = () => { setSavingAvatar(false); toast.error('Could not read that image.'); };
      reader.readAsDataURL(compressed);
    } catch {
      setSavingAvatar(false);
      toast.error('Could not prepare that image.');
    }
  };

  const submit = form.handleSubmit((values) => {
    updateProfile({ ...values, username: values.username.toLowerCase() });
    toast.success('Profile saved');
  });

  return (
    <SettingsLayout title="Profile" description="The little details people see about you.">
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-panel p-5 shadow-card sm:flex-row sm:text-left">
          <div className="relative"><Avatar name={user.displayName} initials={user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)} size="xl" color="from-indigo-300 to-violet-200" /><button type="button" onClick={() => inputRef.current?.click()} aria-label="Change profile photo" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-xl border-2 border-panel bg-brand-500 text-white shadow-sm"><Camera size={16} /></button><input ref={inputRef} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></div>
          <div className="min-w-0 flex-1 text-center sm:text-left"><p className="text-sm font-semibold">Profile photo</p><p className="mt-1 text-xs text-muted">A clear photo helps people recognize you.</p><button type="button" onClick={() => inputRef.current?.click()} disabled={savingAvatar} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"><ImagePlus size={14} />{savingAvatar ? 'Preparing…' : 'Upload photo'}</button></div>
          <span className="hidden items-center gap-1 text-[10px] text-emerald-600 sm:flex"><ShieldCheck size={13} />Private by default</span>
        </div>

        <SettingsCard className="p-4 md:p-5"><div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Display name</span><Input {...form.register('displayName')} maxLength={100} /><p className="mt-1 text-[10px] text-rose-600">{form.formState.errors.displayName?.message}</p></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Username</span><span className="relative block"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">@</span><Input {...form.register('username')} className="pl-8" maxLength={50} /></span><p className="mt-1 text-[10px] text-rose-600">{form.formState.errors.username?.message}</p></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Bio</span><textarea {...form.register('bio')} rows={3} maxLength={500} placeholder="A little about you" className="w-full resize-none rounded-xl border border-line bg-panel px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10" /><p className="mt-1 text-right text-[10px] text-muted">{bio?.length ?? 0}/500</p></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Status</span><Input {...form.register('statusText')} maxLength={150} placeholder="What are you up to?" /></label>
          <div className="flex items-center justify-end border-t border-line pt-4"><Button type="submit" disabled={!form.formState.isDirty}><Check size={15} /> Save changes</Button></div>
        </div></SettingsCard>
      </form>
    </SettingsLayout>
  );
}
