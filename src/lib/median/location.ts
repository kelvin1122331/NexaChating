'use client';

import { isMedianApp } from '@/lib/median/bridge';
import type { MedianLocationResult } from '@/lib/types/median';

export interface LocationResult { latitude: number; longitude: number; accuracy: number; }

/** Requests a high-accuracy one-time position through Median or the browser permission API. */
export function getCurrentLocation(): Promise<LocationResult> {
  const nativeGet = window.median?.geolocation?.getCurrentPosition;
  if (isMedianApp() && nativeGet) {
    return nativeGet({ enableHighAccuracy: true, timeout: 10_000 }).then((result: MedianLocationResult) => ({ latitude: result.latitude, longitude: result.longitude, accuracy: result.accuracy }));
  }
  if (!navigator.geolocation) return Promise.reject(new Error('Location is not available on this device.'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 },
    );
  });
}
