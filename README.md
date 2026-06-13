# StepUnlock

*Walk to earn your scroll.* An Android app that turns walking into earned
screen-time: the more you walk, the more you're allowed to scroll. When the
budget runs out, your chosen apps get locked behind a full-screen overlay until
you move.

Personal-use v1 — on-device only, no backend, no Play Store. Android-only
(Health Connect + app-blocking are Android-specific). Full product and
architecture docs live in [`docs/`](./docs).

## Status

| Phase | Scope | State |
|-------|-------|-------|
| **0** | Project setup, Health Connect read on device | ✅ done |
| **1** | Earn loop (steps → live balance), app picker, settings, onboarding | ✅ done |
| **2** | Foreground-service foreground-app detection + spend + native HC reads | ✅ done |
| **3** | The lock: warning → countdown → overlay → auto-clear | ✅ done |
| **3+** | Per-app spend breakdown, reboot survival (BootReceiver) | ✅ done |
| **4** | Battery-optimization exemption, history/insights | ⬜ next |

## Run it

Requires Android SDK + an emulator (Pixel API 35 works; Health Connect is built
into Android 14+) or a real device.

```bash
npm install
npx expo run:android   # prebuild + build dev client + install + start Metro
```

JS changes hot-reload via Metro. Native/manifest/config-plugin changes need a
rebuild (`npx expo run:android` again).

On an emulator there's no real step source — use the `__DEV__`-only
**"+ Add 1,000 test steps"** button on the Today screen to seed Health Connect
and exercise the earn loop.

## How it's built

- **UI** — `src/app` (expo-router): `(tabs)` Today / Apps / Settings, plus an
  `onboarding` permission-gate.
- **State** — `src/state/store.ts`, zustand + MMKV. `remaining` is always derived
  from steps − spend (`src/lib/budget.ts`), never stored.
- **Steps** — Health Connect, `src/lib/healthConnect.ts` + `refreshSteps`.
- **Native** — two local Expo modules in `modules/`: `installed-apps` (picker
  list) and `system-permissions` (Usage Access / overlay / battery deep-links).
- **Config plugins** — `plugins/` (manifest extras + Health Connect wiring).

See [`CLAUDE.md`](./CLAUDE.md) for the Health Connect setup gotchas.

## Default economy

1,000 steps = 10 minutes · reset 06:00 local · hard lock · no rollover.
All editable in Settings.
