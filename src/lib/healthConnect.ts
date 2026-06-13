/**
 * Thin wrapper over react-native-health-connect.
 *
 * The rest of the app only needs three things from Health Connect: is it
 * available, do we have read-steps permission, and how many steps happened in a
 * given time window. Everything Health-Connect-specific is contained here so the
 * UI and store stay platform-agnostic and easy to mock/test.
 */
import {
  aggregateRecord,
  deleteRecordsByTimeRange,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type HealthConnectStatus =
  | 'available'
  | 'unavailable'
  | 'update-required';

const STEPS_READ_PERMISSION = {
  accessType: 'read',
  recordType: 'Steps',
} as const;

let initialized = false;

/** Whether Health Connect is installed and usable on this device. */
export async function checkAvailability(): Promise<HealthConnectStatus> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
    return 'update-required';
  return 'unavailable';
}

/** Initialize the SDK once. Safe to call repeatedly. */
export async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true;
  initialized = await initialize();
  return initialized;
}

/** True if the user has already granted read access to Steps. */
export async function hasStepsPermission(): Promise<boolean> {
  await ensureInitialized();
  const granted = await getGrantedPermissions();
  return granted.some(
    (p) =>
      'recordType' in p &&
      p.recordType === 'Steps' &&
      p.accessType === 'read'
  );
}

/** Prompt for read-steps permission; resolves to whether it ended up granted. */
export async function requestStepsPermission(): Promise<boolean> {
  await ensureInitialized();
  await requestPermission([STEPS_READ_PERMISSION]);
  return hasStepsPermission();
}

/**
 * Total steps in [start, end). Returns 0 when there's no data in the window
 * (Health Connect omits COUNT_TOTAL entirely when nothing matched).
 */
export async function readSteps(start: Date, end: Date): Promise<number> {
  await ensureInitialized();
  const result = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  });
  return result.COUNT_TOTAL ?? 0;
}

/** Deep-link the user into the Health Connect settings screen. */
export function openSettings(): void {
  openHealthConnectSettings();
}

/** Dev-only: delete all Steps records in [start, end) — used to test the lock. */
export async function clearSteps(start: Date, end: Date): Promise<void> {
  await ensureInitialized();
  await deleteRecordsByTimeRange('Steps', {
    operator: 'between',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });
}

/**
 * Dev-only: write a Steps record so the earn loop can be exercised on devices
 * with no real step source (e.g. an emulator). Requests WRITE_STEPS on demand.
 * Not used in production paths — gated behind __DEV__ at the call site.
 */
export async function writeTestSteps(count: number): Promise<void> {
  await ensureInitialized();
  await requestPermission([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'write', recordType: 'Steps' },
  ]);
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 1000); // a 1-minute walk
  await insertRecords([
    {
      recordType: 'Steps',
      count: Math.max(1, Math.round(count)),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  ]);
}
