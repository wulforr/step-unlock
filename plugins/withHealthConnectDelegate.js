// Registers the react-native-health-connect permission delegate in MainActivity.
//
// react-native-health-connect's `requestPermission` drives an Activity Result
// contract that must be registered before the activity resumes. The library
// requires `HealthConnectPermissionDelegate.setPermissionDelegate(this)` in
// MainActivity.onCreate — without it, requestPermission throws
// UninitializedPropertyAccessException. The stock config plugin only adds the
// rationale intent-filter, so we inject the delegate registration here.

const { withMainActivity } = require('@expo/config-plugins');

const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const REGISTER = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

const withHealthConnectDelegate = (config) => {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;

    // Add the import once, right after the package declaration.
    if (!src.includes(IMPORT)) {
      src = src.replace(
        /^(package .*\n)/m,
        `$1${IMPORT}\n`
      );
    }

    // Register the delegate inside onCreate, right after super.onCreate(...).
    if (!src.includes(REGISTER)) {
      src = src.replace(
        /(super\.onCreate\([^)]*\)\n)/,
        `$1    ${REGISTER}\n`
      );
    }

    config.modResults.contents = src;
    return config;
  });
};

module.exports = withHealthConnectDelegate;
