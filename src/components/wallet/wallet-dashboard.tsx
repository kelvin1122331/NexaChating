'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { format, isSameMonth, parseISO } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDownLeft, ArrowUpRight, Check, ChevronRight, CircleHelp,
  LockKeyhole, Plus, ShieldCheck, Sparkles, WalletCards, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWalletStore } from '@/stores/wallet-store';
import { useChatStore } from '@/stores/chat-store';
import { cn } from '@/lib/utils/cn';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const presets = [100_000, 250_000, 500_000, 1_000_000];

function amountLabel(amount: number): string {
  return `${amount < 0 ? '−' : '+'}${rupiah.format(Math.abs(amount))}`;
}

function AddFundsDialog(): JSX.Element {
  const addFunds = useWalletStore((state) => state.addFunds);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('250000');
  const [method, setMethod] = useState('Bank transfer');
  const [step, setStep] = useState<'form' | 'success'>('form');
  const amountNumber = Number(amount);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!Number.isSafeInteger(amountNumber) || amountNumber < 10_000 || amountNumber > 10_000_000) {
      toast.error('Choose an amount between Rp 10,000 and Rp 10,000,000.');
      return;
    }
    addFunds(amountNumber, method);
    setStep('success');
  };

  const close = (nextOpen: boolean): void => { setOpen(nextOpen); if (!nextOpen) setStep('form'); };
  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Trigger asChild><Button><Plus size={16} /> Add money</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[min(430px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-panel p-6 shadow-soft focus:outline-none">
          {step === 'success' ? <div className="py-5 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><Check size={24} /></span><Dialog.Title className="mt-4 text-lg font-semibold">Money added</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted">{rupiah.format(amountNumber)} has been added to your demo balance.</Dialog.Description><Button className="mt-6 w-full" onClick={() => close(false)}>Done</Button></div> : <>
            <div className="flex items-start justify-between"><div><Dialog.Title className="text-lg font-semibold">Add money</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-muted">Choose an amount and a payment method.</Dialog.Description></div><Dialog.Close aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17} /></Dialog.Close></div>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Amount (IDR)</span><Input inputMode="numeric" type="number" min="10000" max="10000000" step="10000" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <div className="grid grid-cols-4 gap-2">{presets.map((value) => <button key={value} type="button" onClick={() => setAmount(String(value))} className={cn('min-h-9 rounded-lg border text-[10px] font-semibold transition', amountNumber === value ? 'border-brand-300 bg-brand-50 text-brand-700 dark:bg-indigo-950/50 dark:text-indigo-200' : 'border-line text-muted hover:bg-slate-50 dark:hover:bg-slate-800')}>Rp {value / 1_000}k</button>)}</div>
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none focus:border-brand-300"><option>Bank transfer</option><option>Debit card</option><option>Virtual account</option></select></label>
              <Button type="submit" className="w-full"><Plus size={15} /> Continue to payment</Button>
              <p className="text-center text-[10px] text-muted">Simulation only — no payment will be taken.</p>
            </form>
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TransferDialog(): JSX.Element {
  const conversations = useChatStore((state) => state.conversations.filter((item) => item.type === 'personal' && item.id !== 'nexa-ai'));
  const balance = useWalletStore((state) => state.balance);
  const makeTransfer = useWalletStore((state) => state.makeTransfer);
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(conversations[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'success'>('form');
  const recipient = conversations.find((item) => item.id === recipientId);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 1_000) { toast.error('Enter a valid amount of at least Rp 1,000.'); return; }
    if (value > balance) { toast.error('Your demo balance is not enough for this transfer.'); return; }
    if (!/^\d{6}$/.test(pin)) { toast.error('Enter your 6-digit wallet PIN.'); return; }
    if (!recipient) { toast.error('Choose a recipient.'); return; }
    makeTransfer(value, recipient.title, note.trim());
    setPin('');
    setStep('success');
  };

  const close = (nextOpen: boolean): void => { setOpen(nextOpen); if (!nextOpen) { setStep('form'); setPin(''); } };
  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Trigger asChild><Button variant="outline"><ArrowUpRight size={16} /> Send money</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] max-h-[90dvh] w-[min(450px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-line bg-panel p-6 shadow-soft focus:outline-none">
          {step === 'success' ? <div className="py-5 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><Check size={24} /></span><Dialog.Title className="mt-4 text-lg font-semibold">Transfer complete</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted">{rupiah.format(Number(amount))} was sent to {recipient?.title} in this demo.</Dialog.Description><Button className="mt-6 w-full" onClick={() => close(false)}>Done</Button></div> : <>
            <div className="flex items-start justify-between"><div><Dialog.Title className="text-lg font-semibold">Send money</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-muted">A simple, secure way to settle up.</Dialog.Description></div><Dialog.Close aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17} /></Dialog.Close></div>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Send to</span><select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none focus:border-brand-300">{conversations.map((contact) => <option key={contact.id} value={contact.id}>{contact.title}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Amount (IDR)</span><Input inputMode="numeric" type="number" min="1000" max={balance} step="1000" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Note <span className="text-muted">(optional)</span></span><Input maxLength={100} placeholder="What’s it for?" value={note} onChange={(event) => setNote(event.target.value)} /></label>
              <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><LockKeyhole size={13} />6-digit wallet PIN</span><Input aria-label="6-digit wallet PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} pattern="[0-9]{6}" placeholder="••••••" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
              <Button type="submit" className="w-full" disabled={!recipient || !amount || pin.length !== 6}><ArrowUpRight size={15} /> Review transfer</Button>
              <p className="text-center text-[10px] text-muted">Demo transfer only — your PIN is never stored.</p>
            </form>
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Wallet dashboard with explicit demo-only transfers and a locally persisted balance. */
export function WalletDashboard(): JSX.Element {
  const balance = useWalletStore((state) => state.balance);
  const transactions = useWalletStore((state) => state.transactions);
  const currentMonth = format(new Date(), 'MMMM yyyy');
  const moneyIn = useMemo(() => transactions.filter((transaction) => transaction.amount > 0 && isSameMonth(parseISO(transaction.createdAt), new Date())).reduce((sum, transaction) => sum + transaction.amount, 0), [transactions]);

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex min-h-[76px] shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3 md:px-8"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><WalletCards size={19} /></span><div><h1 className="text-base font-semibold">Nexa Wallet</h1><p className="mt-0.5 text-[11px] text-muted">Simple money moments, together.</p></div></div><button onClick={() => toast('The wallet is a product preview. Payments aren’t connected.')} aria-label="Wallet help" className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><CircleHelp size={18} /></button></header>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-8"><div className="mx-auto max-w-5xl">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-brand-500 to-violet-500 p-6 text-white shadow-xl shadow-indigo-500/15 md:p-8">
            <div className="absolute -right-14 -top-16 h-48 w-48 rounded-full border border-white/10" /><div className="absolute -right-3 -top-10 h-36 w-36 rounded-full border border-white/10" />
            <div className="relative flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-medium text-white/80"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15"><WalletCards size={16} /></span> Nexa balance</div><span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide">Demo wallet</span></div>
            <p className="relative mt-7 text-[11px] font-medium text-white/65">Available balance</p><p className="relative mt-1 text-[32px] font-semibold tracking-tight md:text-[38px]">{rupiah.format(balance)}</p>
            <div className="relative mt-7 flex flex-wrap gap-2.5"><AddFundsDialog /><TransferDialog /></div>
            <div className="relative mt-6 flex items-center justify-between border-t border-white/15 pt-4 text-[10px] text-white/70"><span>•••• &nbsp;•••• &nbsp;•••• &nbsp; 2048</span><span>Ready when you are</span></div>
          </div>
          <div className="rounded-[28px] border border-line bg-panel p-5 shadow-card md:p-6"><div className="flex items-center justify-between"><div><p className="text-xs text-muted">Money in</p><p className="mt-1 text-xl font-semibold">{rupiah.format(moneyIn)}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><ArrowDownLeft size={19} /></span></div><div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">This month</p><span className="text-[10px] text-muted">{currentMonth}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-[64%] rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" /></div><div className="mt-4 flex items-center justify-between text-[10px] text-muted"><span>Spending overview</span><span>Weekly insights soon</span></div><div className="mt-6 flex items-center gap-3 rounded-2xl bg-indigo-50/70 p-3 dark:bg-indigo-950/30"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300"><Sparkles size={16} /></span><p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">Split a coffee or send a little thank-you, right from chat.</p></div></div>
        </div>

        <div className="mt-7 rounded-3xl border border-line bg-panel shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 md:px-6"><div><h2 className="text-sm font-semibold">Recent activity</h2><p className="mt-1 text-[10px] text-muted">Your latest wallet moments</p></div><button onClick={() => toast('Showing all transactions')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">View all <ChevronRight size={14} /></button></div>
          <div className="divide-y divide-line">{transactions.slice(0, 8).map((transaction) => {
            const incoming = transaction.amount > 0;
            const txDate = parseISO(transaction.createdAt);
            return <div key={transaction.id} className="flex min-h-[72px] items-center gap-3 px-4 py-3 md:px-6"><span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', incoming ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300')}>{incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{transaction.title}</span><span className="mt-1 block text-[10px] text-muted">{transaction.subtitle} · {format(txDate, 'MMM d, h:mm a')}</span></span><span className={cn('text-xs font-semibold tabular-nums', incoming ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100')}>{amountLabel(transaction.amount)}</span></div>;
          })}</div>
          <div className="border-t border-line bg-slate-50/70 px-4 py-3 dark:bg-slate-900/40"><p className="flex items-center gap-2 text-[10px] leading-5 text-muted"><ShieldCheck size={13} className="shrink-0 text-emerald-500" />Wallet is a local demo. No actual payment is processed; never enter a real payment PIN.</p></div>
        </div>
      </div></div>
    </section>
  );
}
