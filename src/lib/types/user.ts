export type AccountType = 'personal' | 'business' | 'admin';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  bio: string;
  statusText: string;
  isOnline: boolean;
  lastSeenAt?: string;
  isVerified: boolean;
  accountType: AccountType;
  locale: string;
  theme: ThemePreference;
}
