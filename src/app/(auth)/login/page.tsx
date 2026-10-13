import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Sign in' };

/** Authentication entry point for NexaChat. */
export default function LoginPage(): JSX.Element {
  return <Suspense fallback={<div className="h-[480px] w-full max-w-[440px] animate-pulse rounded-[28px] bg-panel" />}><LoginForm /></Suspense>;
}
