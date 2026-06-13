/**
 * Bridges the JS store to the native foreground service.
 *
 * - Pushes config (blocked packages, ratio, reset hour) to the service whenever
 *   it changes, and keeps the service running once onboarding is complete so
 *   the persistent balance notification is always present.
 * - Mirrors the service's accumulated spend back into the store on a short
 *   interval, so the Today screen's "Spent" and the balance ring tick live.
 *
 * Mount once, in the root layout. The service itself owns the authoritative
 * spend and survives the app being swiped away; this hook is just the in-app
 * view onto it.
 */
import { useEffect } from 'react';

import {
  getSpendBreakdownToday,
  getSpentSecondsToday,
  startService,
  updateConfig,
} from '@/modules/blocker';
import { enabledBlockedPackages, useStore } from '@/state/store';

/** How often to mirror the service's spend into the store while foregrounded. */
const SPEND_POLL_MS = 1000;

export function useBlockerSync(): void {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const minutesPer1000 = useStore((s) => s.settings.minutesPer1000);
  const resetHour = useStore((s) => s.settings.resetHour);
  const lockMode = useStore((s) => s.settings.lockMode);
  // Stable string key of enabled packages so the effect only re-runs on change.
  const packagesKey = useStore((s) =>
    enabledBlockedPackages(s).sort().join(',')
  );
  const setSpentSeconds = useStore((s) => s.setSpentSeconds);
  const setSpendByPackage = useStore((s) => s.setSpendByPackage);

  // Push config + (re)start the service whenever config changes.
  useEffect(() => {
    if (!onboardingComplete) return;
    const blockedPackages = packagesKey ? packagesKey.split(',') : [];
    updateConfig({ blockedPackages, minutesPer1000, resetHour, lockMode });
    startService();
  }, [onboardingComplete, packagesKey, minutesPer1000, resetHour, lockMode]);

  // Mirror service spend (total + per-app) into the store for live display.
  useEffect(() => {
    if (!onboardingComplete) return;
    const tick = () => {
      setSpentSeconds(getSpentSecondsToday());
      setSpendByPackage(getSpendBreakdownToday());
    };
    tick();
    const interval = setInterval(tick, SPEND_POLL_MS);
    return () => clearInterval(interval);
  }, [onboardingComplete, setSpentSeconds, setSpendByPackage]);
}
