'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getPersistStorage } from '@/lib/utils/persist-storage';

export interface WalletTransaction {
  id: string;
  type: 'topup' | 'transfer' | 'payment' | 'cashback';
  title: string;
  subtitle: string;
  amount: number;
  createdAt: string;
}

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  addFunds: (amount: number, method: string) => void;
  makeTransfer: (amount: number, recipient: string, note: string) => void;
}

const initialTransactions: WalletTransaction[] = [
  { id: 'tx-1', type: 'cashback', title: 'Nexa Plus cashback', subtitle: 'Cashback', amount: 25_000, createdAt: '2026-10-12T15:20:00.000Z' },
  { id: 'tx-2', type: 'transfer', title: 'Coffee with Olivia', subtitle: 'Sent to Olivia Chen', amount: -78_000, createdAt: '2026-10-11T08:42:00.000Z' },
  { id: 'tx-3', type: 'topup', title: 'Balance top up', subtitle: 'Bank transfer', amount: 500_000, createdAt: '2026-10-10T04:15:00.000Z' },
];

/** Client-side wallet ledger used for the explicitly simulated wallet experience. */
export const useWalletStore = create<WalletState>()(persist(
  (set) => ({
    balance: 2_485_000,
    transactions: initialTransactions,
    addFunds: (amount, method) => set((state) => ({
      balance: state.balance + amount,
      transactions: [{ id: `tx-${crypto.randomUUID()}`, type: 'topup', title: 'Balance top up', subtitle: method, amount, createdAt: new Date().toISOString() }, ...state.transactions],
    })),
    makeTransfer: (amount, recipient, note) => set((state) => ({
      balance: state.balance - amount,
      transactions: [{ id: `tx-${crypto.randomUUID()}`, type: 'transfer', title: note || `Sent to ${recipient}`, subtitle: `Sent to ${recipient}`, amount: -amount, createdAt: new Date().toISOString() }, ...state.transactions],
    })),
  }),
  {
    name: 'nexachat-wallet-demo-v1',
    skipHydration: true,
    storage: createJSONStorage(getPersistStorage),
    partialize: (state) => ({ balance: state.balance, transactions: state.transactions }),
  },
));
