package expo.modules.blocker

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant

/**
 * Reads today's step total straight from Health Connect inside the service.
 *
 * This is what lets the balance keep topping up live even when the JS app has
 * been swiped away — the service no longer depends on JS pushing a cached step
 * count. It mirrors src/lib/healthConnect.ts: a single aggregate over the
 * logical-day window. Safe to call repeatedly; returns null when Health Connect
 * is unavailable or read-steps permission isn't granted, in which case the
 * caller keeps the last-known value.
 */
class StepReader(private val context: Context) {
  private val client: HealthConnectClient? by lazy {
    try {
      if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
        HealthConnectClient.getOrCreate(context)
      } else {
        null
      }
    } catch (e: Throwable) {
      null
    }
  }

  /** Total steps in [startMillis, endMillis), or null if it couldn't be read. */
  suspend fun readSteps(startMillis: Long, endMillis: Long): Long? {
    val hc = client ?: return null
    return try {
      val granted = hc.permissionController.getGrantedPermissions()
      if (!granted.contains(HealthPermission.getReadPermission(StepsRecord::class))) {
        return null
      }
      val response = hc.aggregate(
        AggregateRequest(
          metrics = setOf(StepsRecord.COUNT_TOTAL),
          timeRangeFilter = TimeRangeFilter.between(
            Instant.ofEpochMilli(startMillis),
            Instant.ofEpochMilli(endMillis)
          )
        )
      )
      response[StepsRecord.COUNT_TOTAL] ?: 0L
    } catch (e: Throwable) {
      null
    }
  }
}
