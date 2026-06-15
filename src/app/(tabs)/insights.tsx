import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/banner';
import { Card, StatRow } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useInsights } from '@/hooks/use-insights';
import { useTheme } from '@/hooks/use-theme';
import type { DayKey } from '@/lib/day';
import { formatDuration, formatMinutesLabel, formatSteps } from '@/lib/format';
import { aggregateByPackage, summarize, type DayInsight } from '@/lib/insights';
import { useStore } from '@/state/store';

const EARNED = '#2DB76A';
const SPENT = '#E5484D';
const CHART_HEIGHT = 120;

const WINDOWS = [7, 14, 30] as const;
type Window = (typeof WINDOWS)[number];

export default function InsightsScreen() {
  const theme = useTheme();
  const [windowDays, setWindowDays] = useState<Window>(14);
  const { status, days, error, reload } = useInsights(windowDays);
  const blockedApps = useStore((s) => s.blockedApps);

  const labels = useMemo(
    () => new Map(blockedApps.map((a) => [a.packageName, a.appLabel])),
    [blockedApps]
  );

  const totals = useMemo(() => summarize(days), [days]);
  const topApps = useMemo(() => aggregateByPackage(days).slice(0, 5), [days]);
  const hasData = totals.totalSteps > 0 || totals.totalSpentMinutes > 0;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={status === 'loading'} onRefresh={reload} />
          }>
          <ThemedText type="title" style={styles.heading}>
            Insights
          </ThemedText>

          <View style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]}>
            {WINDOWS.map((w) => {
              const active = w === windowDays;
              return (
                <Pressable
                  key={w}
                  onPress={() => setWindowDays(w)}
                  style={[styles.segment, active && { backgroundColor: theme.background }]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={active ? 'text' : 'textSecondary'}>
                    {w} days
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Banner
              tone="warning"
              title="Steps history unavailable"
              message="Showing recorded screen-time only. Check Health Connect permission."
            />
          ) : null}

          {status === 'loading' && days.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.textSecondary} />
            </View>
          ) : !hasData ? (
            <Card>
              <ThemedText type="smallBold">No history yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Walk to earn time and use your blocked apps — your daily earned
                vs spent will build up here.
              </ThemedText>
            </Card>
          ) : (
            <>
              <Card>
                <StatRow>
                  <ThemedText type="smallBold">Last {windowDays} days</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {totals.activeDays} active
                  </ThemedText>
                </StatRow>
                <SummaryRow
                  color={EARNED}
                  label="Steps walked"
                  value={formatSteps(totals.totalSteps)}
                />
                <SummaryRow
                  color={EARNED}
                  label="Time earned"
                  value={formatMinutesLabel(totals.totalEarnedMinutes)}
                />
                <SummaryRow
                  color={SPENT}
                  label="Time spent"
                  value={formatMinutesLabel(totals.totalSpentMinutes)}
                />
              </Card>

              <Card>
                <StatRow>
                  <ThemedText type="smallBold">Earned vs spent</ThemedText>
                  <View style={styles.legend}>
                    <Dot color={EARNED} />
                    <ThemedText type="small" themeColor="textSecondary">
                      earned
                    </ThemedText>
                    <Dot color={SPENT} />
                    <ThemedText type="small" themeColor="textSecondary">
                      spent
                    </ThemedText>
                  </View>
                </StatRow>
                <DayBars days={days} showLabels={windowDays <= 14} />
              </Card>

              {topApps.length > 0 ? (
                <Card>
                  <ThemedText type="smallBold">Top apps</ThemedText>
                  {topApps.map((app) => (
                    <View key={app.packageName} style={styles.appRow}>
                      <ThemedText
                        type="default"
                        numberOfLines={1}
                        style={styles.appLabel}>
                        {labels.get(app.packageName) ?? app.packageName}
                      </ThemedText>
                      <ThemedText type="default" style={styles.appValue}>
                        {formatDuration(app.seconds / 60)}
                      </ThemedText>
                    </View>
                  ))}
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SummaryRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <StatRow>
      <View style={styles.summaryLabel}>
        <Dot color={color} />
        <ThemedText type="default">{label}</ThemedText>
      </View>
      <ThemedText type="default" style={styles.appValue}>
        {value}
      </ThemedText>
    </StatRow>
  );
}

/** Paired earned/spent bars per day, scaled to the window's peak minute value. */
function DayBars({ days, showLabels }: { days: DayInsight[]; showLabels: boolean }) {
  const max = Math.max(
    1,
    ...days.map((d) => Math.max(d.earnedMinutes, d.spentMinutes))
  );
  const height = (v: number) => (v > 0 ? Math.max(2, (v / max) * CHART_HEIGHT) : 0);
  return (
    <View style={styles.chart}>
      {days.map((d) => (
        <View key={d.day} style={styles.col}>
          <View style={styles.bars}>
            <View style={[styles.bar, { height: height(d.earnedMinutes), backgroundColor: EARNED }]} />
            <View style={[styles.bar, { height: height(d.spentMinutes), backgroundColor: SPENT }]} />
          </View>
          {showLabels ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
              {dayOfMonth(d.day)}
            </ThemedText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

/** "yyyy-MM-dd" → day-of-month number as a label. */
function dayOfMonth(day: DayKey): string {
  return String(Number(day.slice(8, 10)));
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  heading: { fontSize: 34, lineHeight: 40 },
  center: { paddingVertical: Spacing.six, alignItems: 'center' },
  segmented: { flexDirection: 'row', borderRadius: Spacing.two, padding: 2 },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two - 1,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  appValue: { fontWeight: '700' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 18,
    gap: 2,
    marginTop: Spacing.one,
  },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1,
    height: CHART_HEIGHT,
  },
  bar: { width: 5, borderRadius: 2 },
  dayLabel: { fontSize: 9, marginTop: 4 },
  appRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appLabel: { flex: 1, marginRight: Spacing.three },
});
