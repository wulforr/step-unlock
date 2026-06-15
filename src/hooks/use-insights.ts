/**
 * Loads the Insights screen's per-day model: spend history (native, synchronous)
 * joined with steps history (Health Connect, async). Refetches whenever the
 * screen refocuses. If Health Connect fails we still render the spend-only view
 * rather than blanking the screen, and surface the error for a small notice.
 *
 * Also opportunistically prunes spend entries older than the retention window so
 * the service's SharedPreferences don't grow forever.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { readDailySteps } from '@/lib/healthConnect';
import { buildInsights, type DayInsight } from '@/lib/insights';
import { getSpendHistory, pruneSpendHistory } from '@/modules/blocker';
import { useStore } from '@/state/store';

/** Keep this many days of spend history before pruning. */
const RETENTION_DAYS = 90;

export type InsightsState = {
  status: 'loading' | 'ready' | 'error';
  days: DayInsight[];
  error?: string;
  reload: () => void;
};

export function useInsights(windowDays: number): InsightsState {
  const minutesPer1000 = useStore((s) => s.settings.minutesPer1000);
  const resetHour = useStore((s) => s.settings.resetHour);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [days, setDays] = useState<DayInsight[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    pruneSpendHistory(RETENTION_DAYS);
    const spend = getSpendHistory(windowDays);
    try {
      const steps = await readDailySteps(windowDays, resetHour);
      setDays(buildInsights(steps, spend, minutesPer1000));
      setError(undefined);
      setStatus('ready');
    } catch (e) {
      // Health Connect unavailable/denied — still show what spend we have.
      setDays(buildInsights([], spend, minutesPer1000));
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [windowDays, resetHour, minutesPer1000]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { status, days, error, reload: load };
}
