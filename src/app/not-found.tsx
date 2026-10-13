import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { buttonStyles } from '@/components/ui/button';

export default function NotFound(): JSX.Element {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-canvas p-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><MessageCircle size={24} /></span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-brand-600">404 · Lost in the chat?</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page isn’t here.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">The link might be old, or the conversation has moved.</p>
        <Link href="/chat" className={`${buttonStyles({ className: 'mt-6' })}`}><ArrowLeft size={16} /> Back to chats</Link>
      </div>
    </main>
  );
}
