@AGENTS.md

# StepUnlock

Android-only Expo (dev-client) app: walk to earn screen-time, run out and chosen
apps lock. Personal-use v1, on-device only, no backend. See `docs/` for the PRD
and Technical Design Doc — they define the phased roadmap (this code is through
**Phase 3** + reboot survival: the full earn → spend → warn → lock → re-earn loop,
the native lock overlay, and a `BootReceiver` that restarts the service on
BOOT_COMPLETED. Remaining Phase 4: battery-optimization exemption, history/insights.

## Run it
- `npx expo run:android` — prebuilds, builds the dev client, installs, starts Metro.
- Emulator: a Pixel API 35 image works (Health Connect is built into Android 14+).
- JS-only changes hot-reload via Metro; native/manifest/plugin changes need a rebuild.

## Architecture
- **UI** (`src/app`, expo-router): `(tabs)` = Today / Apps / Settings; `onboarding`
  is the permission-gate (redirected to until `onboardingComplete`).
- **State** (`src/state/store.ts`): zustand + MMKV (`createMMKV`, v4 Nitro API).
  Persists settings, blocked apps, per-day spend. `remaining` is always derived
  (`src/lib/budget.ts`), never stored.
- **Steps**: Health Connect via `src/lib/healthConnect.ts`; `refreshSteps` (plain
  fn) is the single reader, driven by `useStepsSync` (interval + on-foreground).
- **Spend** (Phase 2): native foreground service in the `blocker` module owns the
  tick loop — polls UsageStatsManager (~1s) for the foreground app, accumulates
  seconds **per package** in its own SharedPreferences (`spend_<day>_<pkg>`, summed
  for the total; `getSpendBreakdownToday` surfaces the per-app split to the Today
  screen), and shows the persistent balance notification. JS pushes config down
  (`useBlockerSync` → `updateConfig`) and mirrors spend back up
  (`getSpentSecondsToday` → store `spentSeconds`). Service owns spend; JS owns config.
- **Native step reads** (Phase 2.1): the service reads today's steps straight from
  Health Connect every ~30s (`StepReader`, connect-client `aggregate`), so the
  balance tops up live even when the app is swiped away. JS still pushes steps too
  (`setSteps`) for an instant in-app update on foreground; both read the same HC source.
- **Lock** (Phase 3): the service decides lock state each tick with hysteresis —
  engages at remaining ≤ 0, releases only past `LOCK_RELEASE_MINUTES` (anti-flicker).
  When locked + a blocked app is foreground, `OverlayManager` draws a full-screen
  SYSTEM_ALERT_WINDOW (TYPE_APPLICATION_OVERLAY, not-focusable so Home/Back still
  work) showing steps-to-unlock; it auto-clears on re-earn. Spend is frozen while the
  overlay covers the app (you're not charged for time you can't use). `lockMode`
  (hard/soft) is pushed via config; soft adds a "Use anyway" cooldown dismiss.
- **Reboot survival**: `BootReceiver` in the `blocker` module listens for
  BOOT_COMPLETED / MY_PACKAGE_REPLACED and restarts the service (only if apps are
  configured). The real BOOT_COMPLETED grants the FGS-start exemption; a synthetic
  `am broadcast` does not, so verify reboot survival with an actual `adb reboot`.
- **Native**: three local Expo modules in `modules/` — `installed-apps` (app picker
  list), `system-permissions` (Usage Access / overlay / battery checks +
  deep-links), and `blocker` (foreground service + lock overlay + boot receiver).
- **Config plugins** (`plugins/`): `withStepUnlockManifest` (queries +
  Health-Connect `VIEW_PERMISSION_USAGE` alias), `withHealthConnectDelegate`
  (MainActivity permission delegate).

## Health Connect gotchas (hard-won)
- **compileSdk/targetSdk must be 36** (AndroidX transitive deps require it) — set in
  `app.json` build-properties.
- Android 14+ needs a `VIEW_PERMISSION_USAGE` + `HEALTH_PERMISSIONS` activity-alias
  or even **reads** throw "Incorrect health permission state". Handled by the
  manifest plugin.
- `HealthConnectPermissionDelegate.setPermissionDelegate(this)` must run in
  `MainActivity.onCreate` or in-app `requestPermission` throws. Handled by plugin.
- `adb pm grant android.permission.health.READ_STEPS` is **not enough** for data
  ops — the grant must go through the in-app Health Connect permission UI for
  reads/writes to return data.
- Dev seeding: the Today screen has a `__DEV__`-only "+ Add 1,000 test steps" that
  writes a Steps record (emulators have no real step source).
