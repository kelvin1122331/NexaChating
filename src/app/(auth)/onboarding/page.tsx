import { Suspense } from 'react';
import { OnboardingForm } from '@/components/auth/onboarding-form';

export const metadata = { title: 'Set up your profile' };

/** Profile setup page for newly authenticated accounts and local demo users. */
export default function OnboardingPage(): JSX.Element {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading profile setup" className="h-[460px] w-full max-w-[440px] animate-pulse rounded-[28px] bg-panel" />}>
      <OnboardingForm />
    </Suspense>
  );
}
