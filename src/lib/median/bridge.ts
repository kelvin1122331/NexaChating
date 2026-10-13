'use client';

/** True only when the web view is running inside Median.co or GoNative. */
export function isMedianApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.median || window.gonative);
}
