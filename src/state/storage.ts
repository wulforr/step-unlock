/**
 * MMKV-backed storage adapter for zustand's persist middleware.
 *
 * MMKV is synchronous and fast, which matters here: the store is read on every
 * tick of the (future) foreground service and on every render of the live
 * balance. We expose the small async-shaped `StateStorage` surface zustand
 * expects, backed by MMKV's sync calls.
 */
import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

export const mmkv = createMMKV({ id: 'stepunlock' });

export const zustandMMKVStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => {
    mmkv.remove(name);
  },
};
