// Custom Expo config plugin for StepUnlock.
//
// Adds the AndroidManifest pieces that aren't covered by the stock plugins:
//   1. <queries> so the app picker can enumerate launchable apps and so
//      Health Connect's package is visible on Android 11+ (package visibility).
//   2. The Health Connect "view permission usage" activity-alias is handled by
//      the react-native-health-connect plugin; here we only deal with queries.
//
// Phase 2/3 native pieces (foreground service, boot receiver, overlay) live in
// a local Expo module under modules/, so they register their own manifest
// entries and don't need to be injected here.

const { withAndroidManifest } = require('@expo/config-plugins');

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

const withStepUnlockManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    // Let us pop the system "ignore battery optimization?" dialog directly so the
    // foreground service isn't killed by aggressive OEM power management. (Play
    // Store restricts this permission, but StepUnlock is sideloaded/personal-use.)
    if (!Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = [];
    }
    const BATTERY_PERMISSION =
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
    const hasBatteryPermission = manifest['uses-permission'].some(
      (p) => p?.$?.['android:name'] === BATTERY_PERMISSION
    );
    if (!hasBatteryPermission) {
      manifest['uses-permission'].push({
        $: { 'android:name': BATTERY_PERMISSION },
      });
    }

    // Android 14+ platform Health Connect requires the app to declare an
    // activity that handles VIEW_PERMISSION_USAGE with the HEALTH_PERMISSIONS
    // category (it surfaces the app's privacy-policy rationale). Without it,
    // even reads throw "Incorrect health permission state". We point it at
    // MainActivity via an activity-alias.
    if (!Array.isArray(application['activity-alias'])) {
      application['activity-alias'] = [];
    }
    const hasAlias = application['activity-alias'].some(
      (a) => a?.$?.['android:name'] === 'ViewPermissionUsageActivity'
    );
    if (!hasAlias) {
      application['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } },
            ],
            category: [
              { $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } },
            ],
          },
        ],
      });
    }

    // Ensure a <queries> element exists.
    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [];
    }

    manifest.queries.push({
      // Let us see every app that has a launcher icon (the app picker list).
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.LAUNCHER' } },
          ],
        },
      ],
      // Make the Health Connect app visible for availability checks / deep-link.
      package: [{ $: { 'android:name': HEALTH_CONNECT_PACKAGE } }],
    });

    return config;
  });
};

module.exports = withStepUnlockManifest;
