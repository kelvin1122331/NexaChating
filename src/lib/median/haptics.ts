'use client';

import { isMedianApp } from '@/lib/median/bridge';

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection';

/** Triggers Median haptics or a small browser vibration fallback when available. */
export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (isMedianApp() && window.median?.haptics?.generate) {
    try { window.median.haptics.generate({ style }); return; }
    catch (error) { console.warn('[NexaChat haptics]', error); }
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const duration: Record<HapticStyle, number> = { light: 10, medium: 20, heavy: 40, selection: 5 };
    navigator.vibrate(duration[style]);
  }
}
