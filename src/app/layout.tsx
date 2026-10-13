import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppProviders } from '@/app/providers';

export const metadata: Metadata = {
  title: { default: 'NexaChat — Chat smarter. Do more.', template: '%s · NexaChat' },
  description: 'A calmer, more thoughtful place for your conversations and the work that follows.',
  applicationName: 'NexaChat',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'NexaChat' },
  formatDetection: { telephone: false },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f8fc',
};

/** Root document and shared client providers for every NexaChat route. */
export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-[100dvh] overflow-hidden bg-canvas text-ink antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
