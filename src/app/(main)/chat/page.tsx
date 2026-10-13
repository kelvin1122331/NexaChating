import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, Bot, CheckSquare, MessageCircle, Sparkles, Users2 } from 'lucide-react';

export const metadata = { title: 'Messages' };

/** Desktop inbox welcome state shown until a conversation is selected. */
export default function ChatInboxPage(): JSX.Element {
  return (
    <section className="hidden h-full min-h-0 flex-1 overflow-y-auto p-7 md:block lg:p-10">
      <div className="mx-auto max-w-[1020px]">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.17em] text-brand-600">Tuesday, October 13</p><h1 className="mt-2 text-[26px] font-semibold tracking-tight">Good morning, Alex <span aria-hidden="true">☀️</span></h1><p className="mt-1 text-sm text-muted">Your day, your people, all in one place.</p></div>
          <Link href="/contacts" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800"><Users2 size={16} /> Find people</Link>
        </div>

        <div className="relative mt-8 overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-brand-500 to-violet-500 p-8 text-white shadow-xl shadow-indigo-500/15 lg:p-10">
          <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -right-2 -top-16 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-white/[.06] blur-2xl" />
          <div className="relative max-w-[540px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white/90"><Sparkles size={12} /> A calmer way to stay in sync</span>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight lg:text-[36px]">Your best conversations<br />start right here.</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-indigo-100">Make room for the ideas, people, and little moments that move your day forward.</p>
            <div className="mt-6 flex items-center gap-3">
              <Link href="/chat/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-indigo-50">Start a conversation <ArrowUpRight size={16} /></Link>
              <Link href="/ai-assistant" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"><Bot size={16} /> Meet Nexa AI</Link>
            </div>
          </div>
          <div className="absolute bottom-6 right-10 hidden h-44 w-52 rotate-3 rounded-3xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm lg:block">
            <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-sm">OC</span><span className="text-xs font-semibold">Olivia Chen</span><span className="ml-auto h-2 w-2 rounded-full bg-emerald-300" /></div>
            <div className="mt-4 rounded-2xl rounded-tl-md bg-white/95 px-3 py-2 text-[10px] leading-4 text-slate-600">That looks amazing! Let’s ship it 🚀</div>
            <div className="ml-auto mt-2 w-fit rounded-2xl rounded-tr-md bg-indigo-300/60 px-3 py-2 text-[10px] leading-4 text-white">On it! ✨</div>
            <div className="mt-3 flex justify-end text-[9px] text-white/70">just now&nbsp; ✓✓</div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-4">
          <QuickCard href="/chat/new" icon={<MessageCircle size={18} />} tint="indigo" eyebrow="Stay close" title="Start a chat" detail="Pick up where a good idea begins." />
          <QuickCard href="/tasks" icon={<CheckSquare size={18} />} tint="emerald" eyebrow="Keep momentum" title="Your tasks" detail="Turn conversations into progress." />
          <QuickCard href="/ai-assistant" icon={<Bot size={18} />} tint="violet" eyebrow="Think together" title="Nexa AI" detail="A thoughtful hand when you need one." />
        </div>

        <div className="mt-8 flex items-center justify-between rounded-3xl border border-line bg-panel p-5 shadow-card">
          <div className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><Sparkles size={19} /></span><div><p className="text-sm font-semibold">A little space for what matters</p><p className="mt-1 text-xs text-muted">Your chats are ready whenever you are.</p></div></div>
          <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-600 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> You’re all caught up</span>
        </div>
      </div>
    </section>
  );
}

function QuickCard({ href, icon, tint, eyebrow, title, detail }: { href: string; icon: ReactNode; tint: 'indigo' | 'emerald' | 'violet'; eyebrow: string; title: string; detail: string }): JSX.Element {
  const tints = {
    indigo: 'bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  };
  return (
    <Link href={href} className="group rounded-3xl border border-line bg-panel p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tints[tint]}`}>{icon}</span>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">{eyebrow}</p>
      <div className="mt-1 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><ArrowUpRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" /></div>
      <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
    </Link>
  );
}
