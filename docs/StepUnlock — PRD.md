# StepUnlock — Product Requirements Document

*Walk to earn your scroll. The more you walk, the more screen-time you're allowed on the apps that suck you in. Run out, and they lock until you move.*

**Status:** Draft v1 · personal-use release
**Owner:** teammax
**Date:** June 2026
**Companion doc:** [StepUnlock — Technical Design Doc](./#%20StepUnlock%20—%20Technical%20Design%20Doc.md) (architecture, permissions, data model, build roadmap)

---

## 1. Problem & context

I lose hours to a handful of apps — Instagram, YouTube, games — and the time disappears without me deciding to spend it. Existing screen-time tools (Digital Wellbeing, app timers, focus blockers) all share the same flaw: they're **pure restriction**. You set a limit, you hit it, you tap "ignore for 15 minutes," and nothing was earned or lost. There's no cost, so the limit has no teeth, and there's no reward for the behavior I actually want more of — moving.

Separately, I want to walk more. But step trackers live in their own silo: they count, they congratulate, and that's it. The motivation is abstract ("you're 2,000 steps from your goal") and disconnected from anything I care about in the moment.

**The insight:** these two problems cancel each other out. The thing I want less of (mindless scrolling) can pay for itself with the thing I want more of (walking). Make screen-time a *currency you earn by moving*, and both behaviors get a feedback loop they're missing today.

## 2. Why now

- **Health Connect is finally the right foundation.** Google Fit's APIs are deprecated and shut down at the end of 2026 — building on them now means building on something already dead. Health Connect is on-device, account-free, and fuses step data from every source (phone, Samsung Health, Fitbit, wearables) behind one permission. The platform piece this app depends on just became stable and is the clear long-term bet. Waiting doesn't make it easier; it only shortens Fit's remaining life if I hesitate.
- **Personal scope removes the hard blockers.** Building this for myself first sidesteps Play Store policy review (Usage Access, overlays, Accessibility are all scrutinized) and multi-device sync. I can ship a working tool to my own phone in weeks instead of negotiating store policy for months. The hard product question — *does earning screen-time actually change my behavior?* — is answerable now, cheaply, with an audience of one.

## 3. Who it's for & the "after" state

**Primary user (v1):** me — and people like me who already track steps, already feel the pull of a few specific apps, and are willing to sideload a build. Self-motivated, not looking to be policed by someone else.

**Life after this ships:** I open Instagram and there's a real, felt cost — I'm spending minutes I walked for. When I'm low, the app nudges me to walk instead of guilt-tripping me. A lunchtime walk visibly tops up my balance. Over a week, I notice I either walk more, scroll less, or both — and neither felt like punishment.

**Explicitly NOT for (v1):** parents controlling kids' phones, teams/accountability groups, iOS users, or anyone who needs tamper-proof enforcement. Those are real markets but different products. (See Out of Scope.)

## 4. Success criteria

This is a personal motivation tool, so success is **behavioral**, not vanity metrics. I'll run it on my own phone for 3–4 weeks after Phase 3 and judge against:

| Question | What success looks like | How I'll know |
|----------|------------------------|---------------|
| Does the loop actually run? | The full earn → spend → warn → lock → re-earn cycle works reliably across a real day, surviving reboots and the app being swiped away. | Daily use without the service silently dying. |
| Does it change behavior? | Either my daily steps go up **or** my time in blocked apps goes down vs. my baseline — ideally both. | Compare week-1 baseline (tracking only, no lock) to weeks 2–4 (lock on). |
| Is the cost *felt* but not infuriating? | I respect the lock more often than I rage-disable it. The warning + "Add" nudge feels like a fair prompt, not a wall. | Self-reported; count how often I bypass vs. go walk. |
| Does the balance feel honest? | The remaining-minutes number matches my intuition of what I earned and spent. No "where did my time go" confusion. | Gut check against the Today screen daily. |

**Anti-goals / guardrails:** the app must not feel like a cage. If the most common reaction is to disable it, the *design* failed even if the code works. Battery drain should be unnoticeable in normal use.

## 5. Core experience (the product loop)

You pick a set of distraction apps. Each day you start at **zero budget** for them. Walking earns budget; using those apps spends it. The state machine the user actually experiences:

| State | When | What I see |
|-------|------|-----------|
| **Open** | more than 10 min left | Apps work normally. A quiet notification shows my balance. |
| **Warning** | 10 min or less left | Notification + in-app banner: "10 min left." An **"Add"** action opens StepUnlock to show how many steps buy more time. |
| **Final countdown** | last 10 min | Notification ticks down live: 10…9…8 min. |
| **Locked** | 0 left | Full-screen overlay covers the app: "Walk to unlock — X steps = Y min." Clears automatically once I've earned enough. |

The balance **tops up live** as steps climb — walk at lunch and your remaining minutes go up even while an app is open. That continuous feedback is the heart of the product; it's what separates "earned screen-time" from "a timer that counts down."

**Default economy (all tunable in-app):** 1,000 steps = 10 minutes. Budget is cumulative across all blocked apps. Strict daily reset at 06:00, no rollover — keeps the loop honest.

> Engineering detail (how foreground detection, the tick loop, the overlay, and budget math actually work) lives in the [Technical Design Doc §2–4](./#%20StepUnlock%20—%20Technical%20Design%20Doc.md). This PRD intentionally doesn't restate it.

## 6. Requirements for v1

**Must have (the loop doesn't exist without these):**
- Read today's steps from Health Connect and convert to a live minutes balance.
- Pick which installed apps to block.
- Detect when a blocked app is in the foreground and spend budget in real seconds.
- The four graduated states above, including the auto-clearing lock overlay.
- A persistent balance display (the foreground-service notification).
- Guided onboarding that walks me through the three system-settings permissions (Health Connect, Usage Access, Display-over-other-apps) and verifies each is on.
- Survive reboot and app-swipe-away.

**Should have:**
- Settings: edit the ratio, reset hour, soft-vs-hard lock.
- Per-app breakdown of time spent on the Today screen.
- Battery-optimization-exemption step in onboarding (OEM background-kill defense).

**Could have (later phases):**
- History / insights screen.
- AccessibilityService "strict mode" for zero-latency, glimpse-free blocking.
- Rollover-up-to-a-cap option.

## 7. Explicitly out of scope for v1

Naming these prevents scope creep and keeps the build to weeks, not months:

- **No anti-cheat / tamper-proofing.** It's my own phone; I can force-stop the service or uninstall. The lock is a motivation tool, not a cage. Hardening (device-admin, settings cool-down, accountability partner) is a deliberate *later* decision.
- **No backend.** Everything is on-device. A backend only earns its place if cross-device sync, accountability buddies, or anti-tamper become goals.
- **No iOS.** Health Connect + app-blocking are Android-specific. iOS would be a different architecture entirely.
- **No Play Store publishing.** Personal sideloaded / EAS build only. Publishing means real policy work on Usage Access, overlays, and `QUERY_ALL_PACKAGES`.
- **The ~1s "glimpse" gap is accepted.** UsageStatsManager polling lets a blocked app flash for a second before the overlay lands. Fine for v1; AccessibilityService closes it later.

## 8. Key risks (product-level)

The technical risks (OEM background-kill, the glimpse gap, battery, Health Connect availability) are catalogued in the [design doc §8](./#%20StepUnlock%20—%20Technical%20Design%20Doc.md). The risks that could sink the *product* regardless of clean code:

- **The economy is wrong.** If 1,000 steps = 10 min feels too generous, the lock never bites; too stingy, and I just disable it in frustration. Mitigation: ratio is editable at runtime, and week-1 runs lock-off to calibrate against my real baseline before enforcement turns on.
- **Friction kills adoption before the loop proves itself.** Three system-settings permissions is a steep onboarding for an audience of one who already knows what the app does — tolerable. But it's the single biggest barrier if this ever broadens. Worth watching even at personal scale.
- **It works but doesn't change behavior.** The real failure mode. If after 4 weeks neither steps nor scroll-time moved, the premise — that earned screen-time motivates — is wrong, and no feature polish fixes that. This is why §4's behavioral test matters more than shipping the feature list.

## 9. Open decisions

Decisions already locked for v1 (name, ratio, strict reset at 06:00, no anti-cheat, no backend) are recorded in the [design doc](./#%20StepUnlock%20—%20Technical%20Design%20Doc.md#decisions-locked-for-v1). Still genuinely open:

1. **Soft vs. hard lock as the default.** Hard (full overlay, bounce out) is the current default. Does a soft mode (dismissible nag) actually get used, or is it a cop-out that defeats the point? Decide after living with hard for a week.
2. **What "re-earned" threshold clears the lock.** Does it clear the instant `remaining > 0`, or require a small buffer (e.g. 2 min) so I'm not re-locked three steps later? Lean toward a small buffer.
3. **Build vs. buy on the native blocking layer.** Use `expo-app-blocker` as-is, or write a thin custom module for full control? Resolve in Phase 2 once I've felt the off-the-shelf version's limits.

## 10. Validation plan

Following "demos before memos" — the design doc's [build roadmap](./#%20StepUnlock%20—%20Technical%20Design%20Doc.md#9-build-roadmap) is itself the prototyping plan, and each phase produces something runnable I can react to:

- **Phase 1 (earn loop, no blocking):** prove the balance *numbers feel right* before building any enforcement. This is the cheapest place to discover the economy is wrong.
- **Phase 2 (detection + spend):** confirm spending feels accurate and the notification balance is trustworthy.
- **Phase 3 (the lock):** the real test — does the warning → countdown → lock → re-earn loop change what I do? Run the 3–4 week behavioral measurement here.
- **Phase 4 (polish/hardening):** only invest here once the loop has earned it.
