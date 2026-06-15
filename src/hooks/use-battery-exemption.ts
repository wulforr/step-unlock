/**
 * Tracks whether StepUnlock is exempt from battery optimization.
 *
 * The exemption keeps the foreground service alive on aggressive OEMs; it can be
 * revoked by the user or the system at any time, so we re-read it whenever the
 * screen refocuses or the app returns to the foreground (e.g. after the user
 * comes back from the system dialog). Android-only — resolves to `true`
 * elsewhere so no nag shows on platforms without the concept.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
} from '@/modules/system-permissions';

export function useBatteryExemption() {
  const [exempt, setExempt] = useState(true);

  const recheck = useCallback(() => {
    if (Platform.OS !== 'android') return;
    try {
      setExempt(isIgnoringBatteryOptimizations());
    } catch {
      // Treat a read failure as "exempt" so we don't nag on a false negative.
      setExempt(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      recheck();
    }, [recheck])
  );

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        recheck();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [recheck]);

  /** Pop the system dialog, then re-read so the UI updates when they return. */
  const request = useCallback(() => {
    requestIgnoreBatteryOptimizations();
  }, []);

  return { exempt, request, recheck };
}
