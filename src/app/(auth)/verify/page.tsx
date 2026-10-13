import { Suspense } from 'react';
import { VerifyOtpForm } from '@/components/auth/verify-otp-form';

export const metadata = { title: 'Verify your phone' };

export default function VerifyPage(): JSX.Element {
  return <Suspense fallback={<div className="h-[420px] w-full max-w-[440px] animate-pulse rounded-[28px] bg-panel" />}><VerifyOtpForm /></Suspense>;
}
