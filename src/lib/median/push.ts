'use client';

import { isMedianApp } from '@/lib/median/bridge';

/** Links a signed-in Supabase user to the OneSignal identity exposed by Median. */
export function registerPushToken(userId: string, onToken: (playerId: string, pushToken: string) => void): void {
  if (!isMedianApp() || !window.median) return;
  const bridge = window.median;
  try {
    bridge.oneSignalRegisterExternalUserId?.({ externalUserId: userId });
    bridge.onesignalInfo?.getRegistrationId?.((data) => {
      if (data.oneSignalUserId && data.oneSignalPushToken) onToken(data.oneSignalUserId, data.oneSignalPushToken);
    });
  } catch (error) {
    console.warn('[NexaChat push]', error);
  }
}

/** Removes the current external OneSignal ID when a user signs out. */
export function unregisterPush(): void {
  if (!isMedianApp() || !window.median) return;
  try { window.median.oneSignalRemoveExternalUserId?.(); }
  catch (error) { console.warn('[NexaChat push]', error); }
}
