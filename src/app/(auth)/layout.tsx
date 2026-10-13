import type { ReactNode } from 'react';

/** Clean, centered shell used for sign-in and account verification pages. */
export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return <main className="flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-canvas px-4 py-8">{children}</main>;
}
