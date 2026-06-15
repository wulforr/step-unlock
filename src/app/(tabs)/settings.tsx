import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBatteryExemption } from '@/hooks/use-battery-exemption';
import { useTheme } from '@/hooks/use-theme';
import { stepsPerMinute } from '@/lib/budget';
import { formatSteps } from '@/lib/format';
import { useStore, type LockMode } from '@/state/store';

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const theme = useTheme();
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(clamp(value - step))}
        style={[styles.stepBtn, { backgroundColor: theme.backgroundSelected }]}
        hitSlop={8}>
        <Ionicons name="remove" size={20} color={theme.text} />
      </Pressable>
      <ThemedText type="default" style={styles.stepValue}>
        {value}
        {suffix ?? ''}
      </ThemedText>
      <Pressable
        onPress={() => onChange(clamp(value + step))}
        style={[styles.stepBtn, { backgroundColor: theme.backgroundSelected }]}
        hitSlop={8}>
        <Ionicons name="add" size={20} color={theme.text} />
      </Pressable>
    </View>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: LockMode;
  onChange: (v: LockMode) => void;
}) {
  const theme = useTheme();
  const options: { key: LockMode; label: string }[] = [
    { key: 'hard', label: 'Hard' },
    { key: 'soft', label: 'Soft' },
  ];
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segment,
              active && { backgroundColor: theme.background },
            ]}>
            <ThemedText
              type="smallBold"
              themeColor={active ? 'text' : 'textSecondary'}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useStore((s) => s.settings);
  const setMinutesPer1000 = useStore((s) => s.setMinutesPer1000);
  const setResetHour = useStore((s) => s.setResetHour);
  const setLockMode = useStore((s) => s.setLockMode);
  const { exempt: batteryExempt, request: requestBattery } = useBatteryExemption();

  const stepsForOneMin = Math.round(stepsPerMinute(settings.minutesPer1000));

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.heading}>
            Settings
          </ThemedText>

          <Card>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <ThemedText type="default">Earn rate</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Minutes earned per 1,000 steps
                </ThemedText>
              </View>
              <Stepper
                value={settings.minutesPer1000}
                onChange={setMinutesPer1000}
                min={1}
                max={60}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              ≈ {formatSteps(stepsForOneMin)} steps per minute of screen-time.
            </ThemedText>
          </Card>

          <Card>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <ThemedText type="default">Daily reset</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Budget resets at this hour, no rollover
                </ThemedText>
              </View>
              <Stepper
                value={settings.resetHour}
                onChange={setResetHour}
                min={0}
                max={23}
                suffix=":00"
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Resets daily at {pad2(settings.resetHour)}:00 local time.
            </ThemedText>
          </Card>

          <Card>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <ThemedText type="default">Lock mode</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Hard = full overlay · Soft = dismissible nag
                </ThemedText>
              </View>
              <Segmented value={settings.lockMode} onChange={setLockMode} />
            </View>
          </Card>

          <Card>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <ThemedText type="default">Background reliability</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Ignore battery optimization so the blocker keeps running
                </ThemedText>
              </View>
              {batteryExempt ? (
                <View style={styles.statusOn}>
                  <Ionicons name="checkmark-circle" size={20} color="#2DB76A" />
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    On
                  </ThemedText>
                </View>
              ) : (
                <Pressable
                  onPress={requestBattery}
                  style={[styles.enableBtn, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold">Enable</ThemedText>
                </Pressable>
              )}
            </View>
            {!batteryExempt ? (
              <ThemedText type="small" themeColor="textSecondary">
                Without this, Android may kill the blocker in the background and
                apps won’t lock when you run out of budget.
              </ThemedText>
            ) : null}
          </Card>

          <Link href="/onboarding" asChild>
            <Pressable>
              <Card>
                <View style={styles.settingRow}>
                  <ThemedText type="default">Permissions</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Review Health Connect, Usage Access, and overlay permissions.
                </ThemedText>
              </Card>
            </Pressable>
          </Link>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  heading: { fontSize: 34, lineHeight: 40, marginBottom: Spacing.one },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  settingText: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 52, textAlign: 'center', fontWeight: '700' },
  statusOn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  enableBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  segmented: { flexDirection: 'row', borderRadius: Spacing.two, padding: 2 },
  segment: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two - 1,
  },
});
