import type { StateStorage } from 'zustand/middleware';

const serverStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/** Returns localStorage in the browser and a no-op store during server rendering. */
export function getPersistStorage(): StateStorage {
  return typeof window === 'undefined' ? serverStorage : window.localStorage;
}
