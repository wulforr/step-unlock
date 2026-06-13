import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInstalledApps, type InstalledApp } from '@/modules/installed-apps';
import { useStore } from '@/state/store';

export default function AppsScreen() {
  const theme = useTheme();
  const blockedApps = useStore((s) => s.blockedApps);
  const setAppBlocked = useStore((s) => s.setAppBlocked);

  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    getInstalledApps()
      .then((list) => {
        if (!cancelled) setApps(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledSet = useMemo(
    () =>
      new Set(blockedApps.filter((a) => a.enabled).map((a) => a.packageName)),
    [blockedApps]
  );

  const visible = useMemo(() => {
    if (!apps) return [];
    // User-facing apps first; pre-installed system apps are usually noise.
    const userApps = apps.filter((a) => !a.isSystemApp);
    const q = query.trim().toLowerCase();
    if (!q) return userApps;
    return userApps.filter(
      (a) =>
        a.appLabel.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q)
    );
  }, [apps, query]);

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            Apps
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Pick which apps spend your walking budget. {enabledSet.size} blocked.
          </ThemedText>
        </View>

        <View
          style={[
            styles.search,
            { backgroundColor: theme.backgroundElement },
          ]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? (
          <ThemedText type="small" style={styles.error}>
            Couldn’t list apps: {error}
          </ThemedText>
        ) : apps === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.text} />
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.packageName}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const enabled = enabledSet.has(item.packageName);
              return (
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <ThemedText type="default" numberOfLines={1}>
                      {item.appLabel}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      numberOfLines={1}>
                      {item.packageName}
                    </ThemedText>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(v) =>
                      setAppBlocked(
                        { packageName: item.packageName, appLabel: item.appLabel },
                        v
                      )
                    }
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.empty}>
                No apps match “{query}”.
              </ThemedText>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 2 },
  heading: { fontSize: 34, lineHeight: 40 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.two, fontSize: 16 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  rowText: { flex: 1, gap: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { padding: Spacing.three, color: '#E5484D' },
  empty: { textAlign: 'center', padding: Spacing.four },
});
