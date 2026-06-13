package expo.modules.blocker

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context

/**
 * Detects the current foreground app by replaying UsageStatsManager events.
 *
 * The catch with UsageStats: a foreground event fires once when an app is
 * opened, not continuously. So we can't just query "the last few seconds" — if
 * the user sits in one app, that window goes empty. Instead we keep the last
 * resolved package across ticks and only update it when a newer foreground
 * event appears, querying a window that overlaps the previous one so no event
 * is missed. A MOVE_TO_BACKGROUND for the current package with nothing newer
 * means the user left it (home screen / recents) — we clear to "".
 */
class UsageDetector(context: Context) {
  private val usm =
    context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

  private var lastQueryEnd = 0L
  private var currentPackage: String = ""

  /** Seed from the recent past so we know the foreground app at startup. */
  fun seed() {
    val now = System.currentTimeMillis()
    poll(now - SEED_WINDOW_MS, now)
    lastQueryEnd = now
  }

  /** Resolve and return the current foreground package ('' if idle/home). */
  fun currentForegroundPackage(): String {
    val now = System.currentTimeMillis()
    // Overlap the previous window slightly to avoid dropping a boundary event.
    val begin = if (lastQueryEnd == 0L) now - SEED_WINDOW_MS
    else lastQueryEnd - OVERLAP_MS
    poll(begin, now)
    lastQueryEnd = now
    return currentPackage
  }

  private fun poll(begin: Long, end: Long) {
    if (end <= begin) return
    val events = usm.queryEvents(begin, end)
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND,
        UsageEvents.Event.ACTIVITY_RESUMED -> {
          currentPackage = event.packageName
        }
        UsageEvents.Event.MOVE_TO_BACKGROUND,
        UsageEvents.Event.ACTIVITY_PAUSED -> {
          // Only clear if the app that left is the one we're tracking and
          // nothing newer has resumed in this batch.
          if (event.packageName == currentPackage) {
            currentPackage = ""
          }
        }
      }
    }
  }

  companion object {
    private const val SEED_WINDOW_MS = 60_000L
    private const val OVERLAP_MS = 2_000L
  }
}
