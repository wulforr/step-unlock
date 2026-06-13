/**
 * Derives the live balance from store state + the budget model. One place the
 * UI reads "where do I stand right now" so every screen agrees.
 */
import {
  earnedMinutes,
  lockStateFor,
  remainingMinutes,
  spentMinutes,
  type LockState,
} from '@/lib/budget';
import { useStore } from '@/state/store';

export type Balance = {
  steps: number;
  earned: number;
  spent: number;
  remaining: number;
  state: LockState;
  minutesPer1000: number;
};

export function useBalance(): Balance {
  const steps = useStore((s) => s.steps);
  const minutesPer1000 = useStore((s) => s.settings.minutesPer1000);
  const secondsSpent = useStore((s) => s.spentSeconds);

  const earned = earnedMinutes(steps, minutesPer1000);
  const spent = spentMinutes(secondsSpent);
  const remaining = remainingMinutes(steps, secondsSpent, minutesPer1000);

  return {
    steps,
    earned,
    spent,
    remaining,
    state: lockStateFor(remaining),
    minutesPer1000,
  };
}
