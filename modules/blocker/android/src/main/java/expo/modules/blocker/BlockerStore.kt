package expo.modules.blocker

import android.content.Context
import java.util.Calendar
import java.util.Locale

/**
 * SharedPreferences-backed shared state between the JS module and the service.
 *
 * JS writes config (blocked packages, ratio, reset hour) and the live step
 * count; the service writes accumulated spend. Spend is keyed by logical day so
 * it resets at the configured reset hour with no rollover — mirroring
 * src/lib/day.ts and src/lib/budget.ts so both sides agree on the balance.
 */
class BlockerStore(context: Context) {
  private val prefs = context.applicationContext
    .getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  companion object {
    private const val PREFS = "stepunlock_blocker"
    private const val KEY_PACKAGES = "blocked_packages"
    private const val KEY_RATIO = "minutes_per_1000"
    private const val KEY_RESET_HOUR = "reset_hour"
    private const val KEY_LOCK_MODE = "lock_mode"
    private const val KEY_STEPS = "steps"
    private const val KEY_SPEND_PREFIX = "spend_"
  }

  // --- config (JS-owned) ---

  fun saveConfig(
    packages: Set<String>,
    minutesPer1000: Int,
    resetHour: Int,
    lockMode: String
  ) {
    prefs.edit()
      .putStringSet(KEY_PACKAGES, packages)
      .putInt(KEY_RATIO, minutesPer1000)
      .putInt(KEY_RESET_HOUR, resetHour)
      .putString(KEY_LOCK_MODE, lockMode)
      .apply()
  }

  val blockedPackages: Set<String>
    get() = prefs.getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet()

  val minutesPer1000: Int
    get() = prefs.getInt(KEY_RATIO, 10)

  val resetHour: Int
    get() = prefs.getInt(KEY_RESET_HOUR, 6)

  /** "hard" (full overlay) or "soft" (dismissible nag). */
  val lockMode: String
    get() = prefs.getString(KEY_LOCK_MODE, "hard") ?: "hard"

  // --- steps (JS-pushed cache) ---

  var steps: Int
    get() = prefs.getInt(KEY_STEPS, 0)
    set(value) = prefs.edit().putInt(KEY_STEPS, value.coerceAtLeast(0)).apply()

  // --- spend (service-owned) ---

  /** Logical-day key (yyyy-MM-dd) for `now`, shifted back by the reset hour. */
  fun logicalDayKey(nowMillis: Long = System.currentTimeMillis()): String {
    val cal = Calendar.getInstance()
    cal.timeInMillis = nowMillis
    cal.add(Calendar.HOUR_OF_DAY, -resetHour)
    return String.format(
      Locale.US,
      "%04d-%02d-%02d",
      cal.get(Calendar.YEAR),
      cal.get(Calendar.MONTH) + 1,
      cal.get(Calendar.DAY_OF_MONTH)
    )
  }

  /** Epoch-millis start of the logical day `now` falls in (its reset hour). */
  fun logicalDayStartMillis(nowMillis: Long = System.currentTimeMillis()): Long {
    val cal = Calendar.getInstance()
    cal.timeInMillis = nowMillis
    if (cal.get(Calendar.HOUR_OF_DAY) < resetHour) {
      cal.add(Calendar.DAY_OF_MONTH, -1)
    }
    cal.set(Calendar.HOUR_OF_DAY, resetHour)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
  }

  /** End of the logical day = start + 24h. */
  fun logicalDayEndMillis(nowMillis: Long = System.currentTimeMillis()): Long =
    logicalDayStartMillis(nowMillis) + 24L * 60L * 60L * 1000L

  /** Per-package key for today: spend_<daykey>_<package>. */
  private fun todayPrefix(): String = "$KEY_SPEND_PREFIX${logicalDayKey()}_"

  /** Total spend across all blocked apps today (sum of the per-app entries). */
  fun spentSecondsToday(): Int {
    val prefix = todayPrefix()
    return prefs.all.entries
      .filter { it.key.startsWith(prefix) && it.value is Int }
      .sumOf { it.value as Int }
  }

  /** Per-package spend for today: { package -> seconds }. */
  fun spendBreakdownToday(): Map<String, Int> {
    val prefix = todayPrefix()
    return prefs.all.entries
      .filter { it.key.startsWith(prefix) && it.value is Int }
      .associate { it.key.removePrefix(prefix) to (it.value as Int) }
  }

  /** Add elapsed foreground seconds to a package's spend for today. */
  fun addSpentSeconds(packageName: String, seconds: Int) {
    if (seconds <= 0 || packageName.isEmpty()) return
    val key = todayPrefix() + packageName
    prefs.edit().putInt(key, prefs.getInt(key, 0) + seconds).apply()
  }

  /** Live remaining-minutes balance: earned − spent. May be ≤ 0. */
  fun remainingMinutes(): Double {
    val earned = (steps.toDouble() / 1000.0) * minutesPer1000
    val spent = spentSecondsToday().toDouble() / 60.0
    return earned - spent
  }

  /** Steps still needed to reach `targetMinutes` of remaining budget. */
  fun stepsToReach(targetMinutes: Double): Int {
    val deficit = targetMinutes - remainingMinutes()
    if (deficit <= 0 || minutesPer1000 <= 0) return 0
    return Math.ceil(deficit * (1000.0 / minutesPer1000)).toInt()
  }
}
