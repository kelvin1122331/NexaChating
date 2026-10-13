import {
  CacheFirst,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: WorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[];
  location: URL;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) => request.method === 'GET'
        && url.origin === self.location.origin
        && url.pathname.startsWith('/_next/static/'),
      handler: new StaleWhileRevalidate({
        cacheName: 'nexachat-next-static-v1',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })],
      }),
    },
    {
      matcher: ({ request, url }) => request.method === 'GET'
        && url.origin === self.location.origin
        && (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json'),
      handler: new CacheFirst({
        cacheName: 'nexachat-public-assets-v1',
        plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: '/offline.html', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
