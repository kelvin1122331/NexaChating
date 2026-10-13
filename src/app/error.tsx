'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Root-level error boundary with a safe retry action. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }): JSX.Element {
  useEffect(() => {
    console.error('NexaChat application error', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-canvas p-6 text-ink">
        <section role="alert" className="max-w-md rounded-3xl border border-line bg-panel p-8 text-center shadow-soft">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle size={22} /></span>
          <h1 className="mt-5 text-xl font-semibold">That didn’t go as planned</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Your conversations are safe. Try loading this view again.</p>
          <Button className="mt-6 w-full" onClick={reset}><RotateCcw size={16} /> Try again</Button>
        </section>
      </body>
    </html>
  );
}
