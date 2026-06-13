package expo.modules.installedapps

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class InstalledAppsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("InstalledApps")

    // Returns every app that exposes a launcher activity, sorted by label,
    // excluding StepUnlock itself. Runs off the JS thread via AsyncFunction.
    AsyncFunction("getInstalledApps") {
      val pm = context.packageManager
      val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
      }

      val resolveInfos = pm.queryIntentActivities(launcherIntent, 0)
      val seen = HashSet<String>()
      val result = ArrayList<Map<String, Any>>()

      for (info in resolveInfos) {
        val appInfo = info.activityInfo.applicationInfo
        val pkg = appInfo.packageName
        if (pkg == context.packageName) continue
        if (!seen.add(pkg)) continue

        val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
        val label = pm.getApplicationLabel(appInfo).toString()

        result.add(
          mapOf(
            "packageName" to pkg,
            "appLabel" to label,
            "isSystemApp" to isSystem
          )
        )
      }

      result.sortedBy { (it["appLabel"] as String).lowercase() }
    }
  }
}
