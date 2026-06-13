/**
 * The single source of truth for StepUnlock's JS side.
 *
 * Persisted (MMKV): user settings, the blocked-app list, onboarding state. NOT
 * persisted: live step count, spend, and Health Connect status — steps come
 * from Health Connect and spend is owned by the native foreground service
 * (which persists it itself), so JS just mirrors them for display.
 *
 * `remaining` is never stored. It's always derived from steps − spend via
 * lib/budget so there's exactly one definition of the balance.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { logicalDayKey, type DayKey } from '@/lib/day';
import { zustandMMKVStorage } from '@/state/storage';

export type LockMode = 'soft' | 'hard';

export type BlockedApp = {
  packageName: string;
  appLabel: string;
  enabled: boolean;
};

export type Settings = {
  /** Minutes of budget per 1,000 steps. Default 10 (Decisions §2). */
  minutesPer1000: number;
  /** Hour of day (0–23) the budget resets. Default 6 (Decisions §3). */
  resetHour: number;
  /** Hard = full overlay; soft = dismissible nag. Default hard (§Data model). */
  lockMode: LockMode;
};

type PersistedState = {
  settings: Settings;
  blockedApps: BlockedApp[];
  onboardingComplete: boolean;
};

export type HealthStatus = 'loading' | 'available' | 'unavailable' | 'update-required';

type RuntimeState = {
  /** Live step total for the current logical day, from Health Connect. */
  steps: number;
  /** Today's spend in seconds, mirrored from the native service. */
  spentSeconds: number;
  /** Per-package spend in seconds today, mirrored from the service. */
  spendByPackage: Record<string, number>;
  /** The logical day the runtime currently reflects. */
  currentDay: DayKey;
  /** Health Connect availability, kept fresh by the steps-sync loop. */
  healthStatus: HealthStatus;
  /** Whether read-steps permission is currently granted. */
  healthPermitted: boolean;
};

type Actions = {
  // settings
  setMinutesPer1000: (v: number) => void;
  setResetHour: (v: number) => void;
  setLockMode: (v: LockMode) => void;
  // blocked apps
  setBlockedApps: (apps: BlockedApp[]) => void;
  toggleBlockedApp: (packageName: string) => void;
  /** Upsert an app's blocked state (used by the picker for unseen apps). */
  setAppBlocked: (app: { packageName: string; appLabel: string }, enabled: boolean) => void;
  // onboarding
  setOnboardingComplete: (v: boolean) => void;
  // daily loop
  rollToToday: () => void;
  setSteps: (steps: number) => void;
  setSpentSeconds: (seconds: number) => void;
  setSpendByPackage: (breakdown: Record<string, number>) => void;
  setHealthStatus: (status: HealthStatus, permitted: boolean) => void;
};

export type StoreState = PersistedState & RuntimeState & Actions;

export const DEFAULT_SETTINGS: Settings = {
  minutesPer1000: 10,
  resetHour: 6,
  lockMode: 'hard',
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // persisted defaults
      settings: DEFAULT_SETTINGS,
      blockedApps: [],
      onboardingComplete: false,
      // runtime defaults
      steps: 0,
      spentSeconds: 0,
      spendByPackage: {},
      currentDay: logicalDayKey(new Date(), DEFAULT_SETTINGS.resetHour),
      healthStatus: 'loading',
      healthPermitted: false,

      setMinutesPer1000: (v) =>
        set((s) => ({ settings: { ...s.settings, minutesPer1000: v } })),
      setResetHour: (v) =>
        set((s) => ({ settings: { ...s.settings, resetHour: v } })),
      setLockMode: (v) =>
        set((s) => ({ settings: { ...s.settings, lockMode: v } })),

      setBlockedApps: (apps) => set({ blockedApps: apps }),
      toggleBlockedApp: (packageName) =>
        set((s) => ({
          blockedApps: s.blockedApps.map((a) =>
            a.packageName === packageName ? { ...a, enabled: !a.enabled } : a
          ),
        })),

      setAppBlocked: (app, enabled) =>
        set((s) => {
          const exists = s.blockedApps.some(
            (a) => a.packageName === app.packageName
          );
          if (exists) {
            return {
              blockedApps: s.blockedApps.map((a) =>
                a.packageName === app.packageName ? { ...a, enabled } : a
              ),
            };
          }
          return {
            blockedApps: [
              ...s.blockedApps,
              { packageName: app.packageName, appLabel: app.appLabel, enabled },
            ],
          };
        }),

      setOnboardingComplete: (v) => set({ onboardingComplete: v }),

      rollToToday: () =>
        set((s) => ({
          currentDay: logicalDayKey(new Date(), s.settings.resetHour),
        })),

      // These three are written on a 1s/30s polling loop. Guard them to no-op
      // when the value is unchanged so we don't notify store subscribers (and
      // risk a state-update-during-mount warning) every tick.
      setSteps: (steps) => {
        const v = Math.max(0, Math.round(steps));
        if (get().steps !== v) set({ steps: v });
      },

      setSpentSeconds: (seconds) => {
        const v = Math.max(0, Math.round(seconds));
        if (get().spentSeconds !== v) set({ spentSeconds: v });
      },

      setSpendByPackage: (breakdown) => {
        // Shallow-equal guard so the 1s poll doesn't churn renders.
        const prev = get().spendByPackage;
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(breakdown);
        const changed =
          prevKeys.length !== nextKeys.length ||
          nextKeys.some((k) => prev[k] !== breakdown[k]);
        if (changed) set({ spendByPackage: breakdown });
      },

      setHealthStatus: (status, permitted) => {
        const s = get();
        if (s.healthStatus !== status || s.healthPermitted !== permitted) {
          set({ healthStatus: status, healthPermitted: permitted });
        }
      },
    }),
    {
      name: 'stepunlock-store',
      storage: createJSONStorage(() => zustandMMKVStorage),
      // Only persist durable state — runtime fields are rehydrated from device.
      partialize: (s): PersistedState => ({
        settings: s.settings,
        blockedApps: s.blockedApps,
        onboardingComplete: s.onboardingComplete,
      }),
    }
  )
);

/** Enabled blocked-app package names — what the foreground service watches. */
export function enabledBlockedPackages(s: StoreState): string[] {
  return s.blockedApps.filter((a) => a.enabled).map((a) => a.packageName);
}
