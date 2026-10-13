'use client';

import { isMedianApp } from '@/lib/median/bridge';

export interface ShareOptions { title?: string; text?: string; url?: string; }

/** Opens the native share sheet or falls back to Web Share without surfacing cancellation errors. */
export async function nativeShare(params: ShareOptions): Promise<boolean> {
  if (isMedianApp() && window.median?.share?.shareRequest) {
    try { window.median.share.shareRequest(params); return true; }
    catch (error) { console.warn('[NexaChat share]', error); return false; }
  }
  if (navigator.share) {
    try { await navigator.share(params); return true; }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false;
      console.warn('[NexaChat share]', error);
      return false;
    }
  }
  return false;
}
