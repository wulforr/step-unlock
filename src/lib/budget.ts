/**
 * The earn / spend budget model — pure functions, no I/O.
 *
 * Earning is steps-based: `minutesPer1000` minutes of screen-time per 1,000
 * steps. Spending is real foreground seconds on blocked apps, cumulative across
 * all of them. Remaining is always derived, never stored:
 *
 *   remaining = steps / 1000 * minutesPer1000 - secondsSpent / 60
 */

/** The four graduated states the user experiences (Tech Design §2). */
export type LockState = 'open' | 'warning' | 'locked';

/** Below this many remaining minutes we enter the warning / countdown band. */
export const WARNING_MINUTES = 10;

/**
 * Minutes of budget earned from a step count. Fractional — we don't round until
 * display, so the balance tops up smoothly as steps climb.
 */
export function earnedMinutes(steps: number, minutesPer1000: number): number {
  return (Math.max(0, steps) / 1000) * minutesPer1000;
}

/** Minutes spent, from accumulated foreground seconds on blocked apps. */
export function spentMinutes(secondsSpent: number): number {
  return Math.max(0, secondsSpent) / 60;
}

/** Live remaining-minutes balance. Can go negative briefly before a lock. */
export function remainingMinutes(
  steps: number,
  secondsSpent: number,
  minutesPer1000: number
): number {
  return earnedMinutes(steps, minutesPer1000) - spentMinutes(secondsSpent);
}

/** Map a remaining-minutes balance to its lock state. */
export function lockStateFor(remaining: number): LockState {
  if (remaining <= 0) return 'locked';
  if (remaining <= WARNING_MINUTES) return 'warning';
  return 'open';
}

/** Steps that buy one more minute, at the current ratio. */
export function stepsPerMinute(minutesPer1000: number): number {
  if (minutesPer1000 <= 0) return Infinity;
  return 1000 / minutesPer1000;
}

/**
 * How many more steps are needed to reach a target remaining balance, given
 * where you are now. Used by the "Add time" affordance and the lock overlay
 * ("walk N more steps = +M min"). Never negative.
 */
export function stepsToReach(
  targetMinutes: number,
  currentSteps: number,
  secondsSpent: number,
  minutesPer1000: number
): number {
  const current = remainingMinutes(currentSteps, secondsSpent, minutesPer1000);
  const deficit = targetMinutes - current;
  if (deficit <= 0) return 0;
  return Math.ceil(deficit * stepsPerMinute(minutesPer1000));
}
