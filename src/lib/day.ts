/**
 * Logical-day helpers.
 *
 * StepUnlock resets the budget at a configurable hour (default 06:00), not at
 * calendar midnight. So the "logical day" a moment belongs to is the calendar
 * date *shifted back* by the reset hour: anything before 06:00 still counts as
 * yesterday's budget. Everything in the app keys off `logicalDayKey()` so the
 * earn/spend/reset loop stays consistent across the reset boundary.
 */

/** A logical-day key in local time, formatted YYYY-MM-DD. */
export type DayKey = string;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The logical-day key for `now`, given the reset hour. Times before `resetHour`
 * belong to the previous calendar date.
 */
export function logicalDayKey(now: Date, resetHour: number): DayKey {
  const shifted = new Date(now.getTime());
  shifted.setHours(shifted.getHours() - resetHour);
  return toKey(shifted);
}

/**
 * Start and end `Date`s of the logical day that `now` falls in. Used to query
 * Health Connect for "today's" steps over the correct window.
 */
export function logicalDayBounds(
  now: Date,
  resetHour: number
): { start: Date; end: Date } {
  const start = new Date(now.getTime());
  if (start.getHours() < resetHour) {
    // Still in the tail of the previous logical day.
    start.setDate(start.getDate() - 1);
  }
  start.setHours(resetHour, 0, 0, 0);

  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);

  return { start, end };
}
