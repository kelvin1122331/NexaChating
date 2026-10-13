'use client';

import { isMedianApp } from '@/lib/median/bridge';

export interface StatusBarStyle {
  style: 'light' | 'dark';
  color: string;
  overlay: boolean;
}

/** Synchronizes the Android/iOS status bar when the Median API is present. */
export function setStatusBarStyle(params: StatusBarStyle): void {
  if (!isMedianApp() || !window.median?.statusbar?.set) return;
  if (!/^#[\da-f]{6}$/i.test(params.color)) return;
  try { window.median.statusbar.set(params); }
  catch (error) { console.warn('[NexaChat status bar]', error); }
}

/** Sets the native navigation bar color where supported. */
export function setNavBarColor(color: string): void {
  if (!isMedianApp() || !window.median?.navigationbar?.set || !/^#[\da-f]{6}$/i.test(color)) return;
  try { window.median.navigationbar.set({ color }); }
  catch (error) { console.warn('[NexaChat navigation bar]', error); }
}
