package expo.modules.blocker

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Draws (and tears down) the full-screen lock overlay over a blocked app.
 *
 * The overlay is a SYSTEM_ALERT_WINDOW of type APPLICATION_OVERLAY that covers
 * the screen and swallows touches, so the blocked app behind it can't be used —
 * the "hard" lock. It's NOT focusable, so Home/Back still work (this is a
 * motivation tool, not a cage: the PRD explicitly accepts that you can leave).
 * Built programmatically so the module needs no layout resources.
 *
 * show() is idempotent and also refreshes the copy; the service calls it every
 * tick while locked-on-a-blocked-app and calls hide() the moment that stops.
 */
class OverlayManager(private val context: Context) {
  private val windowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

  private var root: LinearLayout? = null
  private var headline: TextView? = null
  private var detail: TextView? = null
  private var dismissButton: Button? = null

  val isShowing: Boolean
    get() = root != null

  fun canDraw(): Boolean = Settings.canDrawOverlays(context)

  /**
   * Show or refresh the overlay.
   * @param stepsNeeded steps still required to earn back the release buffer.
   * @param showDismiss soft-mode "Use anyway" affordance.
   * @param onDismiss invoked when the user taps "Use anyway".
   */
  fun show(stepsNeeded: Int, showDismiss: Boolean, onDismiss: () -> Unit) {
    if (!canDraw()) return
    if (root == null) {
      addView(showDismiss, onDismiss)
    }
    headline?.text = "Out of screen-time"
    detail?.text = if (stepsNeeded > 0) {
      "Walk about ${"%,d".format(stepsNeeded)} steps to unlock"
    } else {
      "Walk to unlock"
    }
    dismissButton?.visibility = if (showDismiss) View.VISIBLE else View.GONE
  }

  fun hide() {
    val view = root ?: return
    try {
      windowManager.removeView(view)
    } catch (_: Throwable) {
      // Already detached; ignore.
    }
    root = null
    headline = null
    detail = null
    dismissButton = null
  }

  private fun addView(showDismiss: Boolean, onDismiss: () -> Unit) {
    val density = context.resources.displayMetrics.density
    fun dp(v: Int) = (v * density).toInt()

    val container = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#F20B0B0F"))
      setPadding(dp(32), dp(32), dp(32), dp(32))
    }

    val lock = TextView(context).apply {
      text = "🔒"
      textSize = 48f
      gravity = Gravity.CENTER
    }
    val title = TextView(context).apply {
      text = "Out of screen-time"
      setTextColor(Color.WHITE)
      textSize = 26f
      gravity = Gravity.CENTER
      setPadding(0, dp(16), 0, dp(8))
    }
    val sub = TextView(context).apply {
      text = "Walk to unlock"
      setTextColor(Color.parseColor("#C7C9D1"))
      textSize = 16f
      gravity = Gravity.CENTER
    }
    val open = Button(context).apply {
      text = "Open StepUnlock"
      setOnClickListener { openApp() }
    }
    val dismiss = Button(context).apply {
      text = "Use anyway"
      visibility = if (showDismiss) View.VISIBLE else View.GONE
      setOnClickListener { onDismiss() }
    }

    container.addView(lock)
    container.addView(title)
    container.addView(sub)
    container.addView(open, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(24) })
    container.addView(dismiss, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(8) })

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      // Not focusable → Home/Back keys still reach the system so the user can
      // leave; the window stays touchable so it blocks the app behind it.
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.OPAQUE
    )

    windowManager.addView(container, params)
    root = container
    headline = title
    detail = sub
    dismissButton = dismiss
  }

  private fun openApp() {
    val launch = context.packageManager
      .getLaunchIntentForPackage(context.packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (launch != null) context.startActivity(launch)
  }
}
