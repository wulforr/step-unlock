import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  checkAvailability,
  hasStepsPermission,
  openSettings as openHealthSettings,
  requestStepsPermission,
} from '@/lib/healthConnect';
import {
  canDrawOverlays,
  hasUsageAccess,
  isIgnoringBatteryOptimizations,
  openBatteryOptimizationSettings,
  openOverlaySettings,
  openUsageAccessSettings,
} from '@/modules/system-permissions';
import { useStore } from '@/state/store';

type Status = 'unknown' | 'granted' | 'missing';

type Permissions = {
  health: Status;
  notifications: Status;
  usage: Status;
  overlay: Status;
  battery: Status;
};

const INITIAL: Permissions = {
  health: 'unknown',
  notifications: 'unknown',
  usage: 'unknown',
  overlay: 'unknown',
  battery: 'unknown',
};

function toStatus(granted: boolean): Status {
  return granted ? 'granted' : 'missing';
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setOnboardingComplete = useStore((s) => s.setOnboardingComplete);

  const [perms, setPerms] = useState<Permissions>(INITIAL);

  const recheck = useCallback(async () => {
    // Read each permission independently — a failure in one (e.g. Health
    // Connect not yet initialized) must not blank out the others.
    let health: Status = 'missing';
    try {
      const availability = await checkAvailability();
      health = toStatus(
        availability === 'available' ? await hasStepsPermission() : false
      );
    } catch {
      health = 'missing';
    }

    let notifications: Status = 'missing';
    try {
      const notif = await Notifications.getPermissionsAsync();
      notifications = toStatus(notif.granted);
    } catch {
      notifications = 'missing';
    }

    const safeBool = (fn: () => boolean): Status => {
      try {
        return toStatus(fn());
      } catch {
        return 'missing';
      }
    };

    setPerms({
      health,
      notifications,
      usage: safeBool(hasUsageAccess),
      overlay: safeBool(canDrawOverlays),
      battery: safeBool(isIgnoringBatteryOptimizations),
    });
  }, []);

  // Re-check whenever the screen is focused (e.g. returning from Settings).
  useFocusEffect(
    useCallback(() => {
      recheck();
    }, [recheck])
  );

  // ...and when the app itself returns to the foreground.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        recheck();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [recheck]);

  const grantHealth = async () => {
    const availability = await checkAvailability();
    if (availability !== 'available') {
      openHealthSettings();
      return;
    }
    await requestStepsPermission();
    recheck();
  };

  const grantNotifications = async () => {
    await Notifications.requestPermissionsAsync();
    recheck();
  };

  const requiredGranted =
    perms.health === 'granted' &&
    perms.notifications === 'granted' &&
    perms.usage === 'granted' &&
    perms.overlay === 'granted';

  const finish = () => {
    setOnboardingComplete(true);
    router.replace('/');
  };

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.heading}>
              Set up StepUnlock
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              StepUnlock needs a few permissions to read your steps and lock
              distracting apps. Each opens a system screen — flip it on, then
              come back.
            </ThemedText>
          </View>

          <PermissionRow
            icon="footsteps"
            title="Health Connect"
            subtitle="Read your daily steps to earn budget"
            status={perms.health}
            onPress={grantHealth}
          />
          <PermissionRow
            icon="notifications"
            title="Notifications"
            subtitle="Show your live balance and warnings"
            status={perms.notifications}
            onPress={grantNotifications}
          />
          <PermissionRow
            icon="eye"
            title="Usage Access"
            subtitle="Detect which app is in the foreground"
            status={perms.usage}
            onPress={openUsageAccessSettings}
          />
          <PermissionRow
            icon="layers"
            title="Display over other apps"
            subtitle="Draw the lock screen over blocked apps"
            status={perms.overlay}
            onPress={openOverlaySettings}
          />
          <PermissionRow
            icon="battery-charging"
            title="Ignore battery optimization"
            subtitle="Optional — keeps the service alive in the background"
            status={perms.battery}
            optional
            onPress={openBatteryOptimizationSettings}
          />

          <Pressable
            onPress={finish}
            disabled={!requiredGranted}
            style={[
              styles.cta,
              {
                backgroundColor: requiredGranted
                  ? '#2DB76A'
                  : theme.backgroundElement,
              },
            ]}>
            <ThemedText
              type="default"
              style={{
                color: requiredGranted ? '#04210F' : theme.textSecondary,
                fontWeight: '700',
              }}>
              {requiredGranted ? 'Start using StepUnlock' : 'Grant required permissions'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function PermissionRow({
  icon,
  title,
  subtitle,
  status,
  optional,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  status: Status;
  optional?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const granted = status === 'granted';
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={20} color={theme.text} />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="default">
          {title}
          {optional ? (
            <ThemedText type="small" themeColor="textSecondary">
              {'  '}optional
            </ThemedText>
          ) : null}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      {granted ? (
        <Ionicons name="checkmark-circle" size={28} color="#2DB76A" />
      ) : (
        <Pressable
          onPress={onPress}
          style={[styles.grantBtn, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">Grant</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.two, marginBottom: Spacing.one },
  heading: { fontSize: 32, lineHeight: 38 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  grantBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  cta: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
