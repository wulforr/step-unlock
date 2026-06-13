/**
 * Reads today's steps from Health Connect and pushes the result into the store.
 *
 * A plain function (not a hook) so it can be shared by the app-wide sync loop
 * and one-off triggers like pull-to-refresh, without spinning up a second
 * polling interval.
 */
import { logicalDayBounds } from '@/lib/day';
import {
  checkAvailability,
  hasStepsPermission,
  readSteps,
} from '@/lib/healthConnect';
import { setSteps as pushStepsToService } from '@/modules/blocker';
import { useStore } from '@/state/store';

export type RefreshResult = {
  ok: boolean;
  error: string | null;
};

export async function refreshSteps(): Promise<RefreshResult> {
  const store = useStore.getState();
  try {
    store.rollToToday();

    const availability = await checkAvailability();
    if (availability !== 'available') {
      store.setHealthStatus(availability, false);
      return { ok: false, error: null };
    }

    const permitted = await hasStepsPermission();
    store.setHealthStatus('available', permitted);
    if (!permitted) return { ok: false, error: null };

    const { start, end } = logicalDayBounds(
      new Date(),
      store.settings.resetHour
    );
    const steps = await readSteps(start, end);
    store.setSteps(steps);
    // Keep the service's cached step count current so its notification balance
    // matches the app even while the app is in the background.
    pushStepsToService(steps);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
