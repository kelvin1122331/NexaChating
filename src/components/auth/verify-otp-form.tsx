'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, MessageCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** Phone OTP verification with resend cooldown and single-use Supabase code exchange. */
export function VerifyOtpForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const requestedNext = searchParams.get('next');
  const next = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/chat';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const verify = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { toast.error('Enter the 6-digit code.'); return; }
    if (!supabase) { toast.error('Phone verification is not configured.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setLoading(false);
    if (error) { toast.error(error.message); setCode(''); inputRef.current?.focus(); return; }
    router.replace(next);
  };

  const resend = async (): Promise<void> => {
    if (seconds > 0 || !supabase || !phone) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: 'sms' } });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSeconds(30);
    toast.success('A new code is on the way');
  };

  return (
    <div className="w-full max-w-[440px]"><div className="mb-7 flex items-center justify-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white"><MessageCircle size={20} /></span><span className="text-lg font-bold tracking-tight">NexaChat</span></div>
      <div className="rounded-[28px] border border-line bg-panel p-6 text-center shadow-soft sm:p-8"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><ShieldCheck size={22} /></span><h1 className="mt-4 text-2xl font-semibold tracking-tight">Check your messages</h1><p className="mt-2 text-sm leading-6 text-muted">We sent a 6-digit verification code to<br /><span className="font-semibold text-ink">{phone || 'your phone'}</span>.</p>
        <form onSubmit={(event) => void verify(event)} className="mt-7"><label htmlFor="otp-code" className="sr-only">Six-digit verification code</label><div onClick={() => inputRef.current?.focus()} className="relative mx-auto flex max-w-[300px] cursor-text justify-center gap-2" aria-label="Verification code input">{Array.from({ length: 6 }, (_, index) => <span key={index} className={`grid h-12 w-10 place-items-center rounded-xl border text-lg font-semibold transition sm:h-14 sm:w-12 ${index === code.length ? 'border-brand-400 ring-4 ring-brand-500/10' : 'border-line'} ${code[index] ? 'bg-brand-50/50 dark:bg-indigo-950/20' : 'bg-canvas'}`}>{code[index] ?? ''}</span>)}<input ref={inputRef} id="otp-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" type="tel" maxLength={6} className="absolute inset-0 h-full w-full cursor-text opacity-0" /></div><Button type="submit" loading={loading} disabled={code.length !== 6} className="mt-6 w-full"><Check size={16} /> Verify and continue</Button></form>
        <p className="mt-4 text-xs text-muted">Didn’t get a code? <button onClick={() => void resend()} disabled={seconds > 0 || loading} className="font-semibold text-brand-600 disabled:text-slate-400 dark:text-indigo-300">{seconds > 0 ? `Resend in ${seconds}s` : 'Send a new code'}</button></p>
        <Link href="/login" className="mt-6 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-800"><ArrowLeft size={14} /> Change phone number</Link>
      </div>
    </div>
  );
}
