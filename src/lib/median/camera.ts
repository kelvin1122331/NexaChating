'use client';

import { isMedianApp } from '@/lib/median/bridge';
import type { MedianCaptureResult, MedianMediaResult } from '@/lib/types/median';

function openBrowserPicker(accept: string, multiple: boolean, capture?: 'environment' | 'user', onSelect?: (files: File[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  if (capture) input.capture = capture;
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    onSelect?.(files);
  }, { once: true });
  input.click();
}

/** Opens the Median native camera, falling back to a browser capture input. */
export function openNativeCamera(onCapture: (imageUrl: string) => void): void {
  const nativeCapture = window.median?.camera?.capture;
  if (isMedianApp() && nativeCapture) {
    void nativeCapture({ type: 'photo', quality: 0.8, maxWidth: 1_920, maxHeight: 1_920, saveToGallery: false })
      .then((result: MedianCaptureResult) => onCapture(result.url))
      .catch(() => openBrowserPicker('image/*', false, 'environment', (files) => { if (files[0]) onCapture(URL.createObjectURL(files[0])); }));
    return;
  }
  openBrowserPicker('image/*', false, 'environment', (files) => { if (files[0]) onCapture(URL.createObjectURL(files[0])); });
}

/** Opens the Median gallery or a browser multi-file picker for photos and videos. */
export function openNativeGallery(onSelect: (files: Array<{ url: string; mimeType: string }>) => void): void {
  const nativePick = window.median?.media?.pick;
  if (isMedianApp() && nativePick) {
    void nativePick({ mediaType: 'mixed', maxFiles: 10 })
      .then((results: MedianMediaResult[]) => onSelect(results.map(({ url, mimeType }) => ({ url, mimeType }))))
      .catch(() => openBrowserPicker(
        'image/*,video/*',
        true,
        undefined,
        (files) => onSelect(files.map((file) => ({ url: URL.createObjectURL(file), mimeType: file.type }))),
      ));
    return;
  }
  openBrowserPicker('image/*,video/*', true, undefined, (files) => onSelect(files.map((file) => ({ url: URL.createObjectURL(file), mimeType: file.type }))));
}
