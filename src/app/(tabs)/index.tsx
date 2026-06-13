import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceRing } from '@/components/balance-ring';
import { Banner } from '@/components/banner';
import { Card, StatRow } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBalance } from '@/hooks/use-balance';
import { refreshSteps } from '@/lib/refresh-steps';
import { clearSteps, writeTestSteps } from '@/lib/healthConnect';
import { logicalDayBounds } from '@/lib/day';
import { WARNING_MINUTES, stepsPerMinute, stepsToReach } from '@/lib/budget';
import { formatDuration, formatMinutesLabel, formatSteps } from '@/lib/format';
import { enabledBlockedPackages, useStore } from '@/state/store';
import { useMemo, useState } from 'react';

export default function TodayScreen() {
  const balance = useBalance();
  const healthStatus = useStore((s) => s.healthStatus);
  const healthPermitted = useStore((s) => s.healthPermitted);
  const blockedApps = useStore((s) => s.blockedApps);
  const spendByPackage = useStore((s) => s.spendByPackage);
  const blockedCount = useStore((s) => enabledBlockedPackages(s).length);

  // Per-app spend breakdown: every enabled blocked app, plus any app that
  // already racked up time today (even if since un-blocked), highest first.
  const breakdown = useMemo(() => {
    const labels = new Map(blockedApps.map((a) => [a.packageName, a.appLabel]));
    const packages = new Set<string>([
      ...blockedApps.filter((a) => a.enabled).map((a) => a.packageName),
      ...Object.keys(spendByPackage),
    ]);
    return [...packages]
      .map((pkg) => ({
        packageName: pkg,
        label: labels.get(pkg) ?? pkg,
        seconds: spendByPackage[pkg] ?? 0,
      }))
      .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));
  }, [blockedApps, spendByPackage]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshSteps();
    setRefreshing(false);
  };

  // Steps to climb back to a comfortable 10 min, when below it.
  const stepsForTen = stepsToReach(
    WARNING_MINUTES,
    balance.steps,
    balance.spent * 60,
    balance.minutesPer1000
  );
  const stepsPerTenMin = Math.round(stepsPerMinute(balance.minutesPer1000) * 10);

  const showHealthWarning =
    healthStatus === 'unavailable' ||
    healthStatus === 'update-required' ||
    !healthPermitted;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          <ThemedText type="title" style={styles.heading}>
            Today
          </ThemedText>

          {showHealthWarning ? (
            <Link href="/onboarding" asChild>
              <Pressable>
                <Banner
                  tone="warning"
                  title={
                    healthStatus === 'unavailable'
                      ? 'Health Connect unavailable'
                      : healthStatus === 'update-required'
                        ? 'Health Connect needs an update'
                        : 'Steps permission not granted'
                  }
                  message="Tap to finish setup so StepUnlock can read your steps."
                />
              </Pressable>
            </Link>
          ) : null}

          <View style={styles.ringWrap}>
            <BalanceRing
              remaining={balance.remaining}
              earned={balance.earned}
              state={balance.state}
            />
          </View>

          {balance.state === 'locked' ? (
            <Banner
              tone="danger"
              title="Out of budget"
              message={`Walk ${formatSteps(stepsForTen)} steps to earn ${WARNING_MINUTES} min back.`}
            />
          ) : balance.state === 'warning' ? (
            <Banner
              tone="warning"
              title={`${formatMinutesLabel(balance.remaining)} left`}
              message={`Walk ${formatSteps(stepsForTen)} steps to top back up to ${WARNING_MINUTES} min.`}
            />
          ) : null}

          <Card>
            <StatRow>
              <View style={styles.statLabel}>
                <Ionicons name="footsteps-outline" size={18} color="#2DB76A" />
                <ThemedText type="default">Steps today</ThemedText>
              </View>
              <ThemedText type="default" style={styles.statValue}>
                {formatSteps(balance.steps)}
              </ThemedText>
            </StatRow>
            <StatRow>
              <View style={styles.statLabel}>
                <Ionicons name="add-circle-outline" size={18} color="#2DB76A" />
                <ThemedText type="default">Earned</ThemedText>
              </View>
              <ThemedText type="default" style={styles.statValue}>
                {formatMinutesLabel(balance.earned)}
              </ThemedText>
            </StatRow>
            <StatRow>
              <View style={styles.statLabel}>
                <Ionicons name="remove-circle-outline" size={18} color="#E5484D" />
                <ThemedText type="default">Spent</ThemedText>
              </View>
              <ThemedText type="default" style={styles.statValue}>
                {formatMinutesLabel(balance.spent)}
              </ThemedText>
            </StatRow>
          </Card>

          <Card>
            <ThemedText type="smallBold">Add time</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              At your current rate, every{' '}
              <ThemedText type="smallBold">{formatSteps(stepsPerTenMin)} steps</ThemedText>{' '}
              buys {WARNING_MINUTES} more minutes.
            </ThemedText>
          </Card>

          {__DEV__ ? (
            <Card>
              <ThemedText type="smallBold">Dev tools</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Seed Health Connect steps to exercise the earn loop on an
                emulator.
              </ThemedText>
              <Pressable
                onPress={async () => {
                  try {
                    await writeTestSteps(1000);
                    await refreshSteps();
                  } catch (e) {
                    Alert.alert(
                      'Seed failed',
                      e instanceof Error ? e.message : String(e)
                    );
                  }
                }}>
                <ThemedText type="linkPrimary">+ Add 1,000 test steps</ThemedText>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    const { start, end } = logicalDayBounds(
                      new Date(),
                      useStore.getState().settings.resetHour
                    );
                    await clearSteps(start, end);
                    await refreshSteps();
                  } catch (e) {
                    Alert.alert(
                      'Clear failed',
                      e instanceof Error ? e.message : String(e)
                    );
                  }
                }}>
                <ThemedText type="linkPrimary">Clear today’s steps (test lock)</ThemedText>
              </Pressable>
            </Card>
          ) : null}

          <Card>
            <StatRow>
              <ThemedText type="smallBold">Today’s spend by app</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {blockedCount} blocked
              </ThemedText>
            </StatRow>

            {breakdown.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No apps blocked yet — pick some to start spending budget on them.
              </ThemedText>
            ) : (
              breakdown.map((app) => (
                <StatRow key={app.packageName}>
                  <ThemedText type="default" numberOfLines={1} style={styles.appLabel}>
                    {app.label}
                  </ThemedText>
                  <ThemedText
                    type="default"
                    themeColor={app.seconds > 0 ? 'text' : 'textSecondary'}
                    style={styles.statValue}>
                    {formatDuration(app.seconds / 60)}
                  </ThemedText>
                </StatRow>
              ))
            )}

            <Link href="/apps" asChild>
              <Pressable>
                <ThemedText type="linkPrimary">Manage blocked apps →</ThemedText>
              </Pressable>
            </Link>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  heading: { fontSize: 34, lineHeight: 40 },
  ringWrap: { alignItems: 'center', paddingVertical: Spacing.three },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statValue: { fontWeight: '700' },
  appLabel: { flex: 1, marginRight: Spacing.three },
});
