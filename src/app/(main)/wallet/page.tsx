import type { Metadata } from 'next';
import { WalletDashboard } from '@/components/wallet/wallet-dashboard';

export const metadata: Metadata = { title: 'Wallet' };

/** Wallet preview. All transfers are local simulations until a payment provider is connected. */
export default function WalletPage(): JSX.Element {
  return <WalletDashboard />;
}
