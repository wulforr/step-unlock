/**
 * The "battery" ring on the Today screen: a circular gauge of how much of
 * today's earned budget is still unspent. Color tracks the lock state — calm
 * accent when open, amber in the warning band, red when locked.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import type { LockState } from '@/lib/budget';
import { formatDuration } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

const STATE_COLORS: Record<LockState, string> = {
  open: '#2DB76A',
  warning: '#F2A52B',
  locked: '#E5484D',
};

type Props = {
  /** Remaining minutes (can be ≤ 0). */
  remaining: number;
  /** Today's total earned minutes — the ring's full capacity. */
  earned: number;
  state: LockState;
  size?: number;
  strokeWidth?: number;
};

export function BalanceRing({
  remaining,
  earned,
  state,
  size = 240,
  strokeWidth = 18,
}: Props) {
  const theme = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction = earned > 0 ? Math.max(0, Math.min(1, remaining / earned)) : 0;
  const dashOffset = circumference * (1 - fraction);
  const color = STATE_COLORS[state];

  const label =
    state === 'locked' ? 'Locked' : `${formatDuration(remaining)}`;
  const sublabel = state === 'locked' ? 'walk to unlock' : 'min left';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundElement}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <ThemedText style={[styles.value, { color }]}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {sublabel}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 44,
    fontWeight: '700',
    lineHeight: 50,
  },
});
