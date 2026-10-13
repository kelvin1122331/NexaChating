import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

/** Workspace frame shared by chat, contacts, productivity, wallet and settings routes. */
export default function MainLayout({ children }: { children: ReactNode }): JSX.Element {
  return <AppShell>{children}</AppShell>;
}
