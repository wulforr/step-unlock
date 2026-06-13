package expo.modules.blocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.math.floor

/**
 * The always-on foreground service — StepUnlock's heart.
 *
 * Every tick it asks "what app is on top?" and, if that app is in the blocked
 * set and the screen is on, adds the elapsed real seconds to today's spend. It
 * keeps a persistent notification that doubles as the live balance display. It
 * runs as a foreground service so it survives the app being swiped away, and is
 * START_STICKY so Android restarts it if it's killed.
 *
 * Phase 2 scope: detect + spend + notify. The lock overlay arrives in Phase 3.
 */
class BlockerService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private lateinit var store: BlockerStore
  private lateinit var detector: UsageDetector
  private lateinit var stepReader: StepReader
  private lateinit var overlay: OverlayManager
  private lateinit var powerManager: PowerManager

  private var lastTickMillis = 0L
  private var tickCount = 0L
  @Volatile private var readingSteps = false

  /** Hysteresis: locks at remaining ≤ 0, only releases at the buffer above. */
  private var locked = false
  /** Soft mode: suppress the overlay until this time after "Use anyway". */
  private var softDismissUntil = 0L

  private val ticker = object : Runnable {
    override fun run() {
      tick()
      handler.postDelayed(this, TICK_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    store = BlockerStore(this)
    detector = UsageDetector(this)
    stepReader = StepReader(this)
    overlay = OverlayManager(this)
    powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    createChannel()
    detector.seed()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForegroundCompat(buildNotification())
    running = true
    lastTickMillis = System.currentTimeMillis()
    handler.removeCallbacks(ticker)
    handler.post(ticker)
    return START_STICKY
  }

  override fun onDestroy() {
    running = false
    foregroundPackage = ""
    handler.removeCallbacks(ticker)
    overlay.hide()
    scope.cancel()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun tick() {
    val now = System.currentTimeMillis()
    // Real elapsed seconds since the last tick, capped so a deferred tick
    // (e.g. after doze) can't dump a huge chunk of spend at once.
    val elapsed = ((now - lastTickMillis) / 1000L).toInt().coerceIn(0, MAX_TICK_SECONDS)
    lastTickMillis = now

    val interactive = powerManager.isInteractive
    val pkg = if (interactive) detector.currentForegroundPackage() else ""
    foregroundPackage = pkg
    val onBlockedApp = pkg.isNotEmpty() && store.blockedPackages.contains(pkg)

    // Lock hysteresis: engage at ≤ 0, release only once re-earned past the
    // buffer, so a single re-earned step doesn't immediately re-lock you.
    val remaining = store.remainingMinutes()
    if (!locked && remaining <= 0.0) {
      locked = true
    } else if (locked && remaining >= LOCK_RELEASE_MINUTES) {
      locked = false
      softDismissUntil = 0L
    }

    val softMode = store.lockMode == "soft"
    val softDismissed = softMode && now < softDismissUntil
    val showOverlay =
      interactive && onBlockedApp && locked && !softDismissed && overlay.canDraw()

    // Spend only counts while the app is actually usable — not while the lock
    // overlay is covering it (otherwise the deficit would grow as you stare at
    // the lock screen and could never be walked off).
    if (interactive && onBlockedApp && !showOverlay && elapsed > 0) {
      store.addSpentSeconds(pkg, elapsed)
    }

    if (showOverlay) {
      val stepsNeeded = store.stepsToReach(LOCK_RELEASE_MINUTES)
      overlay.show(stepsNeeded, softMode) {
        softDismissUntil = System.currentTimeMillis() + SOFT_COOLDOWN_MS
        overlay.hide()
      }
    } else {
      overlay.hide()
    }

    // Refresh steps from Health Connect periodically (and on the first tick) so
    // the balance tops up live independent of the JS app being alive.
    if (interactive && (tickCount == 0L || tickCount % STEP_READ_EVERY_TICKS == 0L)) {
      refreshStepsAsync()
    }
    tickCount++

    updateNotification()
  }

  /** Read today's steps off-thread and cache them; ignore overlapping reads. */
  private fun refreshStepsAsync() {
    if (readingSteps) return
    readingSteps = true
    scope.launch {
      try {
        val steps = stepReader.readSteps(
          store.logicalDayStartMillis(),
          store.logicalDayEndMillis()
        )
        if (steps != null) {
          store.steps = steps.toInt()
          android.util.Log.i(
            "BlockerService",
            "native HC read: $steps steps (remaining ${"%.1f".format(store.remainingMinutes())} min)"
          )
          handler.post { updateNotification() }
        }
      } finally {
        readingSteps = false
      }
    }
  }

  // --- notification ---

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "StepUnlock balance",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Shows your remaining screen-time budget"
        setShowBadge(false)
      }
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val remaining = store.remainingMinutes()
    val title: String
    val text: String
    val warning = remaining > 0.0 && remaining <= WARNING_MINUTES
    if (remaining <= 0.0) {
      title = "Out of budget"
      text = "Walk to unlock your apps"
    } else {
      val mins = floor(remaining).toInt()
      val secs = ((remaining - mins) * 60).toInt()
      title = "%d:%02d left".format(mins, secs)
      text = if (warning) "Running low — walk to add time" else "${store.steps} steps today"
    }

    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = launch?.let {
      PendingIntent.getActivity(
        this, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_compass)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(pending)
      .setPriority(NotificationCompat.PRIORITY_LOW)

    // In the warning band, offer an explicit "Add" affordance (PRD §5).
    if ((warning || remaining <= 0.0) && pending != null) {
      builder.addAction(0, "Add", pending)
    }

    return builder.build()
  }

  private fun updateNotification() {
    val nm = getSystemService(NotificationManager::class.java)
    nm.notify(NOTIFICATION_ID, buildNotification())
  }

  private fun startForegroundCompat(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    private const val CHANNEL_ID = "stepunlock_balance"
    private const val NOTIFICATION_ID = 1001
    private const val TICK_MS = 1000L
    private const val MAX_TICK_SECONDS = 5
    /** Read Health Connect steps every this-many ticks (~30s). */
    private const val STEP_READ_EVERY_TICKS = 30L
    /** Balance at/below which we show the warning band (PRD §5). */
    private const val WARNING_MINUTES = 10.0
    /** Re-earn this many minutes past zero to clear a lock (anti-flicker buffer). */
    private const val LOCK_RELEASE_MINUTES = 1.0
    /** Soft mode: how long "Use anyway" suppresses the overlay. */
    private const val SOFT_COOLDOWN_MS = 60_000L

    /** Read by the module for isRunning(). */
    @Volatile var running: Boolean = false
      private set

    /** Last resolved foreground package, exposed to JS for debugging/UI. */
    @Volatile var foregroundPackage: String = ""
      private set

    fun start(context: Context) {
      val intent = Intent(context, BlockerService::class.java)
      context.startForegroundService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, BlockerService::class.java))
    }
  }
}
