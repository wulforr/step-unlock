package expo.modules.blocker

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class BlockerConfigRecord : Record {
  @Field var blockedPackages: List<String> = emptyList()
  @Field var minutesPer1000: Int = 10
  @Field var resetHour: Int = 6
  @Field var lockMode: String = "hard"
}

class BlockerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val store: BlockerStore
    get() = BlockerStore(context)

  override fun definition() = ModuleDefinition {
    Name("Blocker")

    Function("startService") {
      BlockerService.start(context)
    }

    Function("stopService") {
      BlockerService.stop(context)
    }

    Function("isRunning") {
      BlockerService.running
    }

    Function("updateConfig") { config: BlockerConfigRecord ->
      store.saveConfig(
        config.blockedPackages.toSet(),
        config.minutesPer1000,
        config.resetHour,
        config.lockMode
      )
    }

    Function("setSteps") { steps: Int ->
      store.steps = steps
    }

    Function("getSpentSecondsToday") {
      store.spentSecondsToday()
    }

    Function("getSpendBreakdownToday") {
      store.spendBreakdownToday()
    }

    Function("getSpendHistory") { days: Int ->
      store.spendHistory(days)
    }

    Function("pruneSpendHistory") { keepDays: Int ->
      store.pruneSpendOlderThan(keepDays)
    }

    Function("getForegroundPackage") {
      BlockerService.foregroundPackage
    }
  }
}
