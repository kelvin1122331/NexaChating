'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Sparkles, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useChatStore } from '@/stores/chat-store';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

/** Completes a new account profile, with a local-only demo path when Supabase is not configured. */
export function OnboardingForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const updateProfile = useChatStore((state) => state.updateProfile);
  const supabase = getSupabaseBrowserClient();
  const requestedNext = searchParams.get('next');
  const next = useMemo(() => {
    if (!requestedNext?.startsWith('/') || requestedNext.startsWith('//') || requestedNext === '/onboarding') return '/chat';
    return requestedNext;
  }, [requestedNext]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error: profileError } = await supabase.from('users')
        .select('display_name,username')
        .eq('id', user.id)
        .maybeSingle();
      if (!active) return;
      if (profileError) {
        setError('Your profile could not be loaded. Please try again.');
        return;
      }
      setDisplayName(data?.display_name ?? (typeof user.user_metadata.display_name === 'string' ? user.user_metadata.display_name : ''));
      setUsername(data?.username ?? (typeof user.user_metadata.username === 'string' ? user.user_metadata.username : user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ?? ''));
    })();
    return () => { active = false; };
  }, [loading, next, router, supabase, user]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const normalizedName = displayName.trim().replace(/\s+/g, ' ');
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setError('Your name must be between 2 and 80 characters.');
      return;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError('Usernames must be 3–24 characters and use only letters, numbers, and underscores.');
      return;
    }
    setSubmitting(true);
    try {
      if (!supabase) {
        updateProfile({ displayName: normalizedName, username: normalizedUsername });
        toast.success('Your demo profile is ready.');
        router.replace(next);
        return;
      }
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data, error: updateError } = await supabase.from('users')
        .update({ display_name: normalizedName, username: normalizedUsername })
        .eq('id', user.id)
        .select('id')
        .maybeSingle();
      if (updateError || !data) {
        const message = updateError?.code === '23505'
          ? 'That username is already taken. Try another one.'
          : 'Your profile could not be saved. Please try again.';
        setError(message);
        return;
      }
      updateProfile({ id: user.id, displayName: normalizedName, username: normalizedUsername });
      toast.success('Your profile is ready.');
      router.replace(next);
    } catch {
      setError('Your profile could not be saved. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (supabase && (loading || !user)) {
    return <div role="status" aria-label="Loading your account" className="h-[460px] w-full max-w-[440px] animate-pulse rounded-[28px] bg-panel" />;
  }

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-7 flex items-center justify-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20"><Sparkles size={20} /></span>
        <span className="text-lg font-bold tracking-tight">NexaChat</span>
      </div>
      <div className="rounded-[28px] border border-line bg-panel p-6 shadow-soft sm:p-8">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><UserRound size={21} /></span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Make it yours.</h1>
          <p className="mt-1.5 text-sm text-muted">Choose the name and username people will see.</p>
        </div>
        {!supabase ? <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Demo profile changes are saved on this device only.</p> : null}
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Display name</span>
            <Input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Username</span>
            <span className="relative block"><span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">@</span><Input className="pl-8" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} maxLength={24} minLength={3} pattern="[a-zA-Z0-9_]{3,24}" required /></span>
            <span className="mt-1.5 block text-[10px] text-muted">3–24 letters, numbers, or underscores.</span>
          </label>
          {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p> : null}
          <Button type="submit" loading={submitting} className="w-full"><Check size={15} /> Finish setup <ArrowRight size={15} /></Button>
        </form>
      </div>
    </div>
  );
}
