/**
 * Per-day insights model — pure functions, no I/O.
 *
 * Joins the two history sources the Insights screen needs: steps per logical day
 * (Health Connect) and spend per logical day (the native service), keyed by the
 * same yyyy-MM-dd logical-day key so the two always line up. Earned minutes are
 * recomputed from steps at the *current* earn rate — we don't store the rate per
 * day, so a rate change re-scales past earned values. Spend is a real recorded
 * fact, so it's unaffected.
 */
import type { DaySpend } from '@/modules/blocker';
import { earnedMinutes, spentMinutes } from '@/lib/budget';
import type { DayKey } from '@/lib/day';
import type { DailySteps } from '@/lib/healthConnect';

export type DayInsight = {
  day: DayKey;
  steps: number;
  earnedMinutes: number;
  spentMinutes: number;
  /** earned − spent; negative means more screen-time used than walked for. */
  netMinutes: number;
  /** Per-package spend that day, in seconds. */
  byPackage: Record<string, number>;
};

/**
 * Merge steps and spend into one ascending (oldest → newest) per-day series so a
 * chart reads left-to-right chronologically. The union of both key sets is used,
 * so a day with steps but no spend (or vice versa) still appears.
 */
export function buildInsights(
  stepsByDay: DailySteps[],
  spendByDay: DaySpend[],
  minutesPer1000: number
): DayInsight[] {
  const stepsMap = new Map(stepsByDay.map((d) => [d.day, d.steps]));
  const spendMap = new Map(spendByDay.map((d) => [d.day, d]));
  const days = new Set<DayKey>([...stepsMap.keys(), ...spendMap.keys()]);

  return [...days]
    .sort((a, b) => a.localeCompare(b))
    .map((day) => {
      const steps = stepsMap.get(day) ?? 0;
      const spend = spendMap.get(day);
      const earned = earnedMinutes(steps, minutesPer1000);
      const spent = spentMinutes(spend?.total ?? 0);
      return {
        day,
        steps,
        earnedMinutes: earned,
        spentMinutes: spent,
        netMinutes: earned - spent,
        byPackage: spend?.byPackage ?? {},
      };
    });
}

/** Total spend seconds per package across the whole window, highest first. */
export function aggregateByPackage(
  insights: DayInsight[]
): { packageName: string; seconds: number }[] {
  const totals = new Map<string, number>();
  for (const day of insights) {
    for (const [pkg, seconds] of Object.entries(day.byPackage)) {
      totals.set(pkg, (totals.get(pkg) ?? 0) + seconds);
    }
  }
  return [...totals.entries()]
    .map(([packageName, seconds]) => ({ packageName, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

/** Window-level rollup for the header summary. */
export function summarize(insights: DayInsight[]): {
  totalSteps: number;
  totalEarnedMinutes: number;
  totalSpentMinutes: number;
  activeDays: number;
} {
  return insights.reduce(
    (acc, d) => ({
      totalSteps: acc.totalSteps + d.steps,
      totalEarnedMinutes: acc.totalEarnedMinutes + d.earnedMinutes,
      totalSpentMinutes: acc.totalSpentMinutes + d.spentMinutes,
      activeDays: acc.activeDays + (d.steps > 0 || d.spentMinutes > 0 ? 1 : 0),
    }),
    { totalSteps: 0, totalEarnedMinutes: 0, totalSpentMinutes: 0, activeDays: 0 }
  );
}
