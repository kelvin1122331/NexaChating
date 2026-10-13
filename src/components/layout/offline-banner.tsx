'use client';

import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';

/** Small offline status strip; queued messages stay on-device until reconnect. */
export function OfflineBanner(): JSX.Element | null {
  const isOnline = useNetworkStatus();
  if (isOnline) return null;
  return <div role="status" className="fixed inset-x-0 top-0 z-[120] flex min-h-9 items-center justify-center gap-2 bg-slate-900 px-4 py-2 text-[11px] font-medium text-white shadow-sm"><WifiOff size={14} /> You’re offline — messages will send when you reconnect.</div>;
}
