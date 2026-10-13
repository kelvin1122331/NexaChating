'use client';

import { useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Apple, ArrowRight, Github, Mail, MessageCircle, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const identifierSchema = z.object({ identifier: z.string().trim().min(3, 'Enter an email address or phone number.') });
type IdentifierForm = z.infer<typeof identifierSchema>;
type SignInMode = 'email' | 'phone';

/** Supabase magic-link, phone-OTP and OAuth login with a safe local preview path. */
export function LoginForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<SignInMode>('email');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<IdentifierForm>({ resolver: zodResolver(identifierSchema), defaultValues: { identifier: '' } });
  const supabase = getSupabaseBrowserClient();
  const error = searchParams.get('error');
  const next = searchParams.get('next');
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/chat';

  const switchMode = (nextMode: SignInMode): void => {
    setMode(nextMode);
    setSubmitted(false);
    form.reset({ identifier: '' });
  };

  const submit = form.handleSubmit(async ({ identifier }) => {
    if (mode === 'email' && !z.string().email().safeParse(identifier).success) {
      form.setError('identifier', { message: 'Enter a valid email address.' });
      return;
    }
    if (mode === 'phone' && !/^\+?[\d\s().-]{8,20}$/.test(identifier)) {
      form.setError('identifier', { message: 'Enter a valid phone number, including country code.' });
      return;
    }
    if (!supabase) {
      toast('Preview mode is ready — sign-in services are not connected.', { icon: '✨' });
      router.push('/chat');
      return;
    }
    setLoading(true);
    const response = mode === 'email'
      ? await supabase.auth.signInWithOtp({ email: identifier, options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(safeNext)}` } })
      : await supabase.auth.signInWithOtp({ phone: identifier.replace(/[\s().-]/g, ''), options: { channel: 'sms', shouldCreateUser: true } });
    setLoading(false);
    if (response.error) { toast.error(response.error.message); return; }
    if (mode === 'phone') router.push(`/verify?phone=${encodeURIComponent(identifier.replace(/[\s().-]/g, ''))}&next=${encodeURIComponent(safeNext)}`);
    else setSubmitted(true);
  });

  const oauth = async (provider: 'google' | 'apple' | 'github'): Promise<void> => {
    if (!supabase) { toast('Connect Supabase to use social sign-in.', { icon: '✨' }); return; }
    setLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(safeNext)}` } });
    if (oauthError) { setLoading(false); toast.error(oauthError.message); }
  };

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-7 flex items-center justify-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20"><MessageCircle size={20} /></span><span className="text-lg font-bold tracking-tight">NexaChat</span></div>
      <div className="rounded-[28px] border border-line bg-panel p-6 shadow-soft sm:p-8">
        {!submitted ? <>
          <div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><Sparkles size={21} /></span><h1 className="mt-4 text-2xl font-semibold tracking-tight">Good to see you.</h1><p className="mt-1.5 text-sm text-muted">Sign in and pick up where you left off.</p></div>
          {error ? <div role="alert" className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error === 'link-expired' ? 'That sign-in link has expired. Request a fresh one.' : 'Sign-in is not configured yet. You can still explore the preview.'}</div> : null}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Sign-in method"><button role="tab" aria-selected={mode === 'email'} onClick={() => switchMode('email')} className={`flex min-h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition ${mode === 'email' ? 'bg-panel text-ink shadow-sm' : 'text-muted'}`}><Mail size={14} />Email</button><button role="tab" aria-selected={mode === 'phone'} onClick={() => switchMode('phone')} className={`flex min-h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition ${mode === 'phone' ? 'bg-panel text-ink shadow-sm' : 'text-muted'}`}><Phone size={14} />Phone</button></div>
          <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-2">
            <label htmlFor="identifier" className="text-xs font-medium">{mode === 'email' ? 'Email address' : 'Phone number'}</label>
            <Input id="identifier" type={mode === 'email' ? 'email' : 'tel'} inputMode={mode === 'email' ? 'email' : 'tel'} autoComplete={mode === 'email' ? 'email' : 'tel'} placeholder={mode === 'email' ? 'you@example.com' : '+62 812 3456 7890'} {...form.register('identifier')} aria-invalid={Boolean(form.formState.errors.identifier)} />
            {form.formState.errors.identifier ? <p role="alert" className="text-[11px] text-rose-600">{form.formState.errors.identifier.message}</p> : null}
            <Button type="submit" loading={loading} className="mt-2 w-full"><span>{mode === 'email' ? 'Email me a sign-in link' : 'Send verification code'}</span><ArrowRight size={16} /></Button>
          </form>
          <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">or continue with</span><span className="h-px flex-1 bg-line" /></div>
          <div className="grid grid-cols-3 gap-2"><SocialButton icon={<Sparkles size={16} />} label="Google" onClick={() => void oauth('google')} /><SocialButton icon={<Apple size={16} />} label="Apple" onClick={() => void oauth('apple')} /><SocialButton icon={<Github size={16} />} label="GitHub" onClick={() => void oauth('github')} /></div>
          {!supabase ? <button onClick={() => router.push('/chat')} className="mt-5 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"><Sparkles size={14} /> Explore the NexaChat preview</button> : null}
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] leading-5 text-muted"><ShieldCheck size={13} className="shrink-0 text-emerald-500" />Your sign-in is encrypted and always private.</p>
        </> : <div className="py-6 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><Mail size={23} /></span><h1 className="mt-4 text-xl font-semibold">Check your inbox</h1><p className="mt-2 text-sm leading-6 text-muted">We sent a sign-in link to <span className="font-semibold text-ink">{form.getValues('identifier')}</span>. Open it on this device to continue.</p><Button variant="outline" className="mt-6 w-full" onClick={() => setSubmitted(false)}>Use a different email</Button></div>}
      </div>
      <p className="mt-5 text-center text-[10px] leading-5 text-muted">By continuing, you agree to NexaChat’s <a href="/terms" className="underline underline-offset-2">Terms</a> and <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.</p>
    </div>
  );
}

function SocialButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }): JSX.Element {
  return <button type="button" onClick={onClick} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-panel text-xs font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800">{icon}<span>{label}</span></button>;
}
