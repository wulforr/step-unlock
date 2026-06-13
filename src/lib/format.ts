/** Small display formatters. */

/** "1,234" — thousands separators for step counts. */
export function formatSteps(steps: number): string {
  return Math.round(steps).toLocaleString('en-US');
}

/**
 * A remaining/elapsed minutes value as "H:MM" or "M:SS" depending on size.
 * Under an hour we show minutes:seconds so the final countdown ticks visibly.
 */
export function formatDuration(minutes: number): string {
  const clamped = Math.max(0, minutes);
  const totalSeconds = Math.round(clamped * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Whole-minute label, e.g. "42 min". */
export function formatMinutesLabel(minutes: number): string {
  return `${Math.max(0, Math.floor(minutes))} min`;
}
