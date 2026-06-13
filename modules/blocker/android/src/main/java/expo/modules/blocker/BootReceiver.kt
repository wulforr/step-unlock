package expo.modules.blocker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Restarts the foreground service after the device reboots (or the app is
 * updated), so enforcement survives a restart without the user reopening the
 * app — a PRD must-have ("survive reboot").
 *
 * Android delivers BOOT_COMPLETED only after the app has been launched at least
 * once since install, and never while the user has force-stopped it; both are
 * acceptable for a personal tool. We only restart when the user has actually
 * configured blocked apps, so a fresh/unused install doesn't pop a notification
 * out of nowhere on every boot.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      "android.intent.action.QUICKBOOT_POWERON",
      Intent.ACTION_MY_PACKAGE_REPLACED -> {
        val store = BlockerStore(context)
        if (store.blockedPackages.isNotEmpty()) {
          Log.i("BlockerService", "boot/update → restarting service")
          try {
            BlockerService.start(context)
          } catch (e: Throwable) {
            // Some OEMs deliver boot in a state that still disallows starting a
            // foreground service; don't crash the receiver if so. The service
            // will come up the next time the app is opened.
            Log.w("BlockerService", "boot restart blocked: ${e.message}")
          }
        }
      }
    }
  }
}
