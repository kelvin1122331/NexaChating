'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useChatStore } from '@/stores/chat-store';
import { useWalletStore } from '@/stores/wallet-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useMedianBridge } from '@/hooks/use-median-bridge';
import { useOfflineCache } from '@/hooks/use-offline-cache';
import { useRemoteWorkspace } from '@/hooks/use-remote-workspace';

/** Installs client-side query, theme, hydration and accessible toast providers. */
function ClientInitializer(): null {
  useMedianBridge();
  useOfflineCache();
  useRemoteWorkspace();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const screenshotProtection = useSettingsStore((state) => state.privacy.screenshotProtection);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  }));

  useEffect(() => {
    void useChatStore.persist.rehydrate();
    void useWalletStore.persist.rehydrate();
    void useSettingsStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('privacy-protected', screenshotProtection);
  }, [screenshotProtection]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ClientInitializer />
        {children}
        <Toaster position="top-center" closeButton richColors offset={12} toastOptions={{ className: 'font-sans' }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
