/**
 * installed-apps — local Expo module.
 *
 * Lists the launchable apps on the device so the Apps picker can show what's
 * blockable. Android-only; on any other platform the calls reject. The native
 * side reads PackageManager (gated by the <queries>/QUERY_ALL_PACKAGES set up
 * in the manifest plugin).
 */
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type InstalledApp = {
  packageName: string;
  appLabel: string;
  /** True for system apps (pre-installed). The picker hides these by default. */
  isSystemApp: boolean;
};

const nativeModule = Platform.OS === 'android'
  ? requireNativeModule('InstalledApps')
  : null;

/**
 * All apps with a launcher entry, sorted by label. Excludes StepUnlock itself.
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (!nativeModule) return [];
  return nativeModule.getInstalledApps();
}
