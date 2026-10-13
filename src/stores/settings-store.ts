'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getPersistStorage } from '@/lib/utils/persist-storage';

export interface PrivacyPreferences {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  avatarVisibility: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  screenshotProtection: boolean;
}
export interface NotificationPreferences {
  messages: boolean;
  groups: boolean;
  channels: boolean;
  sound: boolean;
  preview: boolean;
}
export interface AutoReplyPreferences {
  enabled: boolean;
  triggerType: 'all' | 'keyword' | 'outside_hours' | 'offline';
  keywords: string;
  reply: string;
  activeStart: string;
  activeEnd: string;
  weekdays: number[];
  cooldownMinutes: number;
}
export interface CustomFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  includeTypes: string[];
  excludeMuted: boolean;
  keyword: string;
}

interface SettingsState {
  privacy: PrivacyPreferences;
  notifications: NotificationPreferences;
  autoReply: AutoReplyPreferences;
  customFolders: CustomFolder[];
  updatePrivacy: (updates: Partial<PrivacyPreferences>) => void;
  updateNotifications: (updates: Partial<NotificationPreferences>) => void;
  updateAutoReply: (updates: Partial<AutoReplyPreferences>) => void;
  addCustomFolder: (folder: Omit<CustomFolder, 'id'>) => void;
  removeCustomFolder: (id: string) => void;
}

/** Persisted privacy and preference controls. Secrets such as wallet PINs are intentionally excluded. */
export const useSettingsStore = create<SettingsState>()(persist(
  (set) => ({
    privacy: { lastSeen: 'everyone', avatarVisibility: 'everyone', readReceipts: true, screenshotProtection: false },
    notifications: { messages: true, groups: true, channels: false, sound: true, preview: true },
    autoReply: { enabled: false, triggerType: 'offline', keywords: '', reply: 'Thanks for your message! I’ll get back to you as soon as I can.', activeStart: '09:00', activeEnd: '17:00', weekdays: [1, 2, 3, 4, 5], cooldownMinutes: 30 },
    customFolders: [],
    updatePrivacy: (updates) => set((state) => ({ privacy: { ...state.privacy, ...updates } })),
    updateNotifications: (updates) => set((state) => ({ notifications: { ...state.notifications, ...updates } })),
    updateAutoReply: (updates) => set((state) => ({ autoReply: { ...state.autoReply, ...updates } })),
    addCustomFolder: (folder) => set((state) => ({ customFolders: [...state.customFolders, { ...folder, id: `folder-${crypto.randomUUID()}` }] })),
    removeCustomFolder: (id) => set((state) => ({ customFolders: state.customFolders.filter((folder) => folder.id !== id) })),
  }),
  {
    name: 'nexachat-settings-v1',
    skipHydration: true,
    storage: createJSONStorage(getPersistStorage),
    partialize: (state) => ({ privacy: state.privacy, notifications: state.notifications, autoReply: state.autoReply, customFolders: state.customFolders }),
  },
));
