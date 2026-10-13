'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { isMedianApp } from '@/lib/median/bridge';
import { registerPushToken, unregisterPush } from '@/lib/median/push';
import { setNavBarColor, setStatusBarStyle } from '@/lib/median/status-bar';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** Initializes native status-bar, push identity, back navigation and deep links. */
export function useMedianBridge(): { isNative: boolean } {
  const [isNative] = useState(() => isMedianApp());
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const router = useRouter();


  useEffect(() => {
    if (!isNative || !user?.id) return;
    let active = true;
    registerPushToken(user.id, (playerId, pushToken) => {
      if (!active) return;
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      void supabase.from('users').update({ onesignal_id: playerId, push_token: pushToken }).eq('id', user.id)
        .then(({ error }) => { if (error) console.warn('[NexaChat push token]', error.message); });
    });
    return () => { active = false; unregisterPush(); };
  }, [isNative, user?.id]);

  useEffect(() => {
    if (!isNative) return;
    const dark = resolvedTheme === 'dark';
    setStatusBarStyle({ style: dark ? 'light' : 'dark', color: dark ? '#0F172A' : '#FFFFFF', overlay: false });
    setNavBarColor(dark ? '#0F172A' : '#FFFFFF');
  }, [isNative, resolvedTheme]);

  useEffect(() => {
    if (!isNative) return;
    const handleDeepLink = (event: Event): void => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      const value = typeof detail === 'string'
        ? detail
        : detail && typeof detail === 'object' && 'url' in detail && typeof detail.url === 'string' ? detail.url : '';
      if (!value) return;
      try {
        const url = new URL(value, window.location.origin);
        if (url.protocol === 'nexachat:') {
          if (url.hostname === 'chat' && url.pathname.length > 1) router.push(`/chat/${encodeURIComponent(url.pathname.slice(1))}`);
          else if (url.hostname === 'profile' && url.pathname.length > 1) router.push(`/contacts/${encodeURIComponent(url.pathname.slice(1))}`);
          return;
        }
        if (url.origin === window.location.origin && url.pathname.startsWith('/')) router.push(`${url.pathname}${url.search}`);
      } catch { console.warn('[NexaChat deep link] Ignored an invalid link.'); }
    };
    const handleBack = (): void => {
      if (window.history.length > 1) router.back();
      else router.push('/chat');
    };
    window.addEventListener('median_deep_link', handleDeepLink);
    window.addEventListener('median_back_button', handleBack);
    return () => {
      window.removeEventListener('median_deep_link', handleDeepLink);
      window.removeEventListener('median_back_button', handleBack);
    };
  }, [isNative, router]);

  return { isNative };
}
