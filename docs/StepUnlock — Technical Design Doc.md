# StepUnlock — Technical Design Doc

*Working title. An Android app that turns walking into earned screen-time: the more you walk, the more you're allowed to scroll. When the budget runs out, your chosen apps get locked.*

**Platform:** Android only (Health Connect + app-blocking are Android-specific)
**Stack:** Expo (React Native) with a custom dev build — **not** Expo Go
**Date:** June 2026

---

## 1. The core idea

You pick a set of "distraction" apps (Instagram, YouTube, games). Each day you start with zero screen-time budget for those apps. As you walk, you **earn** budget from your step count. You **spend** budget while those apps are in the foreground. When you're close to running out you get a warning with an "Add" prompt (go walk more), and when it hits zero the apps are hard-blocked behind a full-screen overlay until you earn more.

It's a personal-use app first — that simplifies a few hard decisions (Play Store policy, multi-device sync) you can revisit later.

---

## 2. The earn / spend model

**Earning (steps-based).** Default rule: **1,000 steps = 10 minutes** of budget (i.e. 1 step ≈ 0.6 sec). Tunable in settings. Steps come from Health Connect, which already fuses sensor + phone + wearable data, so you don't have to detect "walking" yourself — you just read the day's step total.

**Spending.** Budget is consumed only while a *blocked* app is in the foreground, counted in real seconds. Budget is **cumulative across all blocked apps** — exactly as you described. 25 min in Instagram + 35 min in a game = 60 min spent.

**Daily reset.** Both earned and spent reset at local midnight (configurable reset hour). Unused budget does **not** roll over by default — keeps the loop honest. (Optional setting later: allow rollover up to a cap.)

**The running balance**, recomputed continuously:

```
remaining = (steps_today / 1000 * minutes_per_1000) - minutes_spent_today
```

Because steps keep climbing through the day, the budget *tops up live*. Walk during a lunch break and your remaining balance goes up even while an app is open.

**Graduated lock states** (your design):

| State | Condition | Behavior |
|-------|-----------|----------|
| **Open** | remaining > 10 min | Apps work normally. Small persistent notification shows balance. |
| **Warning** | remaining ≤ 10 min | Notification + in-app banner: "10 min left." Shows an **"Add"** action → opens StepUnlock so you can see how many more steps buy more time. |
| **Final countdown** | last 10 min ticking | Notification updates with the live countdown (10…9…8 min). |
| **Locked** | remaining ≤ 0 | Full-screen overlay covers the blocked app and bounces you out. Overlay shows "Walk to unlock — X steps = Y min." Clears automatically once you've walked enough to earn more. |

---

## 3. Why not Google Fit

Google Fit's REST API and Android Fit APIs are **deprecated and shut down at the end of 2026**, with no new sign-ups since May 2024. Building on it now means building on something that's already dead. The official replacement is **Health Connect** — on-device, no cloud account, unified step data from Fit/Samsung Health/Fitbit/sensors, and a single permission model. We use `react-native-health-connect` (+ its `expo-health-connect` config plugin). ([migration FAQ](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq), [react-native-health-connect](https://github.com/matinzd/react-native-health-connect))

---

## 4. Architecture

Three cooperating pieces. Two of them are native and run independently of the JS/React layer — this is the part that makes it more than a normal Expo app.

```
┌─────────────────────────────────────────────────────────┐
│                      StepUnlock app                      │
│                                                          │
│  React Native (JS) UI layer                              │
│   • Today screen: balance, ring, steps, spend            │
│   • App picker: choose which apps to block               │
│   • Settings: ratio, reset hour, lock mode               │
│        │ reads steps                  │ reads/writes      │
│        ▼                              ▼ config            │
│  ┌──────────────┐            ┌────────────────────────┐  │
│  │ Health       │            │ Shared state (SQLite / │  │
│  │ Connect      │            │ MMKV): blocked apps,    │  │
│  │ (steps)      │            │ ratio, today's spend    │  │
│  └──────────────┘            └────────────────────────┘  │
│                                       ▲                   │
│  ── native boundary ──────────────────┼───────────────   │
│                                       │                   │
│  ┌────────────────────────────────────┴───────────────┐  │
│  │ Foreground Service (always running)                │  │
│  │  • Every ~1s: which app is in foreground?          │  │
│  │      └ UsageStatsManager polling (MVP)             │  │
│  │  • If foreground app ∈ blocked set:                │  │
│  │      - tick down remaining budget                  │  │
│  │      - update notification / warning               │  │
│  │      - if remaining ≤ 0 → raise overlay            │  │
│  │  • Reads today's steps from Health Connect         │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Overlay (SYSTEM_ALERT_WINDOW)                       │  │
│  │  • Full-screen "locked" view drawn over the app     │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

The **foreground service** is the heart. It must survive the app being swiped away, so it runs as an Android foreground service with a persistent notification (that notification doubles as your live balance display). It owns the tick loop, the budget math, and the decision to raise/drop the overlay.

### Foreground-app detection: two options

- **UsageStatsManager polling (MVP).** Poll "what's on top?" roughly once a second. Permission is *Usage Access* (`PACKAGE_USAGE_STATS`) — granted in Settings, no Play review issue. Downside: ~1–2s latency, so a user can glimpse a blocked app for a second before the overlay lands. Fine for v1. ([detect foreground app](https://www.thelacunablog.com/detect-foreground-application-android.html))
- **AccessibilityService (later).** Real-time `TYPE_WINDOW_STATE_CHANGED` events → instant overlay, no glimpse. But it's more complex and Google Play heavily restricts Accessibility use, which can block a public listing. Keep it as a v2 upgrade, ideal for a personal sideloaded build.

Recommendation: ship MVP on UsageStatsManager; offer AccessibilityService as an opt-in "strict mode" if you ever want zero-latency blocking.

---

## 5. Android permissions

| Permission | Why | How it's granted |
|------------|-----|------------------|
| Health Connect (read Steps) | earn budget | In-app prompt + Health Connect screen |
| `PACKAGE_USAGE_STATS` (Usage Access) | detect foreground app | Manual toggle in Settings (we deep-link there) |
| `SYSTEM_ALERT_WINDOW` ("Display over other apps") | draw the lock overlay | Manual toggle in Settings (we deep-link there) |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` | keep the tick loop alive | Declared in manifest |
| `POST_NOTIFICATIONS` | balance + warning notifications | Runtime prompt |
| `QUERY_ALL_PACKAGES` *(or a launcher-intent query)* | list installed apps in the picker | Manifest; note: Play restricts this — for a personal build it's fine |
| `RECEIVE_BOOT_COMPLETED` | restart the service after reboot | Manifest |

Three of these (Usage Access, Display-over-other-apps, Health Connect) **cannot be granted by a normal runtime dialog** — they require sending the user into a system Settings screen. So onboarding must be a guided checklist that deep-links each one and verifies it's on.

---

## 6. Data model (local, SQLite or MMKV)

```
settings
  minutes_per_1000_steps   int     default 10    (editable in-app)
  reset_hour               int     default 6     (editable in-app; user's preference)
  lock_mode                enum    soft | hard  default hard
  -- no rollover in v1: strict daily reset at reset_hour

blocked_apps
  package_name   text   (e.g. com.instagram.android)
  app_label      text
  enabled        bool

daily_log                 (one row per local day)
  date              date  (primary key)
  steps_at_*        -- snapshot not needed; read live from Health Connect
  seconds_spent     int   -- accumulated foreground time on blocked apps
  -- remaining is derived, never stored

usage_events              (optional, for the history/insights screen)
  date, package_name, seconds
```

Everything lives on-device. No backend needed for v1. (A backend only becomes interesting if you add cross-device sync, accountability buddies, or anti-tamper.)

---

## 7. Screens (UI scope for v1)

1. **Today** — big circular "battery" ring showing remaining minutes; today's steps; minutes spent; breakdown per blocked app; an **"Add time"** affordance that shows "walk N more steps = +M min."
2. **Apps** — searchable list of installed apps with toggles to mark as blocked.
3. **Settings** — steps→minutes ratio, daily reset hour, soft vs hard lock, rollover toggle.
4. **Onboarding / Permissions checklist** — guided enable of Health Connect, Usage Access, Overlay, Notifications; each with a "Grant" button that deep-links and a live ✓ when detected.
5. **Lock overlay** (native, not an RN screen) — "Locked. Walk to unlock. X steps = Y min."

---

## 8. Key risks & how to handle them

- **The "glimpse" gap.** UsageStatsManager polling lets a blocked app flash for ~1s before the overlay. Acceptable for v1; AccessibilityService closes it later.
- **Self-sabotage / bypassing.** It's your own phone — you can force-stop the service, revoke Usage Access, or uninstall. For a personal motivation tool that's fine. If you want it harder to cheat: device-admin lock, a cool-down before settings can be changed, or an accountability partner who gets notified. Treat as later hardening.
- **Battery.** A 1s poll + foreground service is modest but non-zero. Mitigate: poll at 1s only while *some* app is foreground and slow to 3–5s when the screen is off or no blocked app is open.
- **OEM background-kill** (Xiaomi, Oppo, Samsung aggressive battery managers may kill the service). Handle with `RECEIVE_BOOT_COMPLETED` restart + a "disable battery optimization for this app" step in onboarding.
- **Health Connect not installed / no step source.** On Android 14+ it's built in; older devices need the Health Connect app. Detect and prompt. If the phone has no step sensor and no wearable, there's no data to earn from — surface that clearly.
- **Google Play policy** (Usage Access, overlays, QUERY_ALL_PACKAGES, and especially AccessibilityService are all scrutinized). Not a problem for a personal sideloaded/EAS build; becomes real work if you ever publish.

---

## 9. Build roadmap

**Phase 0 — Project setup**
`npx create-expo-app`, add `expo-dev-client`, `expo-health-connect` + `react-native-health-connect`, `expo-build-properties` (compile/target SDK 34, min SDK 26). Run `npx expo prebuild`, build a dev client with EAS. Confirm you can read today's step count on a real device.

**Phase 1 — Earn loop (JS only, no blocking yet)**
Today screen reads steps, applies the ratio, shows a live balance ring. App picker writes a blocked-app list to local storage. No enforcement — just prove the numbers feel right.

**Phase 2 — Detection + spend**
Native foreground service polling UsageStatsManager; ticks down budget while a blocked app is foreground; persistent notification shows balance. Onboarding checklist for Usage Access + Notifications.

**Phase 3 — The lock**
Overlay module (SYSTEM_ALERT_WINDOW). Wire the graduated states: 10-min warning with "Add", live countdown, hard overlay at zero, auto-clear when re-earned.

**Phase 4 — Polish & hardening**
Boot restart, battery-optimization exemption, OEM quirks, history/insights screen, soft-mode toggle. Optional: AccessibilityService strict mode.

---

## 10. Recommended libraries

- `react-native-health-connect` + `expo-health-connect` — steps
- `expo-dev-client`, `expo-build-properties`, EAS Build — custom native build
- `expo-app-blocker` — bundles UsageStatsManager + foreground service + overlay; good starting point, evaluate vs. writing a thin custom native module for full control
- `expo-notifications` — balance + warning notifications
- `expo-sqlite` or `react-native-mmkv` — local state
- `zustand` — light app-state store on the JS side

---

## Decisions locked for v1

1. **Name** — StepUnlock (personal app, can revisit if ever published).
2. **Ratio** — 1,000 steps = 10 min, editable in-app Settings at runtime.
3. **Reset** — strict daily reset, no rollover; reset hour default **06:00**, editable in-app.
4. **Anti-cheat** — none in v1. The lock is a motivation tool, not a cage — you can disable it on your own phone. Hardening is a later option.
5. **Backend** — none. Everything on-device for v1.

---

### Sources
- [Google Fit migration FAQ — Android Developers](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq)
- [Fit migration guide — Android Developers](https://developer.android.com/health-and-fitness/health-connect/migration/fit)
- [react-native-health-connect (GitHub)](https://github.com/matinzd/react-native-health-connect) · [docs](https://matinzd.github.io/react-native-health-connect/docs/get-started/) · [expo-health-connect](https://github.com/matinzd/expo-health-connect)
- [expo-app-blocker (npm)](https://libraries.io/npm/expo-app-blocker)
- [Detecting the foreground app on Android](https://www.thelacunablog.com/detect-foreground-application-android.html)
- [Expo permissions guide](https://docs.expo.dev/guides/permissions/)