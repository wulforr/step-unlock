/**
 * system-permissions — local Expo module.
 *
 * The three "special" Android permissions StepUnlock needs (Usage Access,
 * Display-over-other-apps, battery-optimization exemption) can't be granted by
 * a runtime dialog — each requires sending the user to a dedicated Settings
 * screen and reading back whether it's now on (Tech Design §5). This module
 * exposes those check + deep-link calls. Android-only.
 */
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const native = Platform.OS === 'android'
  ? requireNativeModule('SystemPermissions')
  : null;

/** Usage Access (PACKAGE_USAGE_STATS) — needed to detect the foreground app. */
export function hasUsageAccess(): boolean {
  return native?.hasUsageAccess() ?? false;
}

export function openUsageAccessSettings(): void {
  native?.openUsageAccessSettings();
}

/** Display-over-other-apps (SYSTEM_ALERT_WINDOW) — needed for the lock overlay. */
export function canDrawOverlays(): boolean {
  return native?.canDrawOverlays() ?? false;
}

export function openOverlaySettings(): void {
  native?.openOverlaySettings();
}

/** Battery-optimization exemption — keeps the service alive on aggressive OEMs. */
export function isIgnoringBatteryOptimizations(): boolean {
  return native?.isIgnoringBatteryOptimizations() ?? false;
}

export function openBatteryOptimizationSettings(): void {
  native?.openBatteryOptimizationSettings();
}

/**
 * Show the system "Allow StepUnlock to ignore battery optimization?" dialog
 * directly — one tap instead of digging through the battery list. No-ops if
 * already exempt; falls back to the settings list if the dialog is unavailable.
 */
export function requestIgnoreBatteryOptimizations(): void {
  native?.requestIgnoreBatteryOptimizations();
}
