/**
 * App-wide loop that keeps the store's step count in sync with Health Connect.
 *
 * Mount once (in the root layout). Re-reads steps on mount, on a slow interval
 * while open — the interval is what makes the balance "top up live" as you walk
 * (Tech Design §2) — and whenever the app returns to the foreground.
 *
 * Phase 1 is JS-only: this is the sole reader of steps. In Phase 2 the
 * foreground service becomes the authoritative ticker; this stays as the
 * in-app refresh.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { refreshSteps } from '@/lib/refresh-steps';

/** How often to re-read steps while the app is in the foreground. */
const REFRESH_MS = 30_000;

export function useStepsSync(): void {
  // Initial load + polling while foregrounded.
  useEffect(() => {
    refreshSteps();
    const interval = setInterval(refreshSteps, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // Refresh the moment the app comes back to the foreground.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refreshSteps();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);
}
