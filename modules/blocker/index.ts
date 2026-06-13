/**
 * blocker — local Expo module (Phase 2+).
 *
 * Owns the native foreground service that is the heart of StepUnlock: it polls
 * the foreground app via UsageStatsManager, accumulates spend on blocked apps in
 * real seconds, and shows the persistent balance notification — all surviving
 * the app being swiped away.
 *
 * Data ownership:
 *   - JS owns config (blocked packages, ratio, reset hour) and the live step
 *     count, and pushes them down with `updateConfig` / `setSteps`.
 *   - The service owns accumulated spend; JS reads it back with
 *     `getSpentSecondsToday` for display.
 *
 * Android-only; calls are no-ops / safe defaults elsewhere.
 */
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type BlockerConfig = {
  /** Package names of currently-enabled blocked apps. */
  blockedPackages: string[];
  /** Minutes of budget per 1,000 steps. */
  minutesPer1000: number;
  /** Hour (0–23) the daily budget resets. */
  resetHour: number;
  /** 'hard' = full blocking overlay; 'soft' = dismissible nag. */
  lockMode: 'hard' | 'soft';
};

const native = Platform.OS === 'android'
  ? requireNativeModule('Blocker')
  : null;

/** Start the foreground service (idempotent). */
export function startService(): void {
  native?.startService();
}

/** Stop the foreground service. */
export function stopService(): void {
  native?.stopService();
}

/** True if the service is currently running. */
export function isRunning(): boolean {
  return native?.isRunning() ?? false;
}

/** Push the latest config to the service. Safe to call often. */
export function updateConfig(config: BlockerConfig): void {
  native?.updateConfig(config);
}

/** Push the latest step count (the service caches it for the balance). */
export function setSteps(steps: number): void {
  native?.setSteps(Math.max(0, Math.round(steps)));
}

/** Seconds of foreground time spent on blocked apps so far today. */
export function getSpentSecondsToday(): number {
  return native?.getSpentSecondsToday() ?? 0;
}

/** Per-package spend today: `{ "com.example": 125, ... }` in seconds. */
export function getSpendBreakdownToday(): Record<string, number> {
  return native?.getSpendBreakdownToday() ?? {};
}

/** The package the service currently sees in the foreground ('' if none/idle). */
export function getForegroundPackage(): string {
  return native?.getForegroundPackage() ?? '';
}
