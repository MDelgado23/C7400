import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { startActivityAsync, ActivityAction } from 'expo-intent-launcher';

/**
 * batteryOptimization — asks Android to exempt the app from Doze / battery
 * optimization.
 *
 * VERIFIED root cause (Moto G35, Android 15): with the screen off, aggressive
 * OEM power management parks the WiFi radio, so the live stream dies with
 * `UnknownHostException (no network)`. ExoPlayer's WakeLock keeps the CPU awake
 * but does NOT keep the network alive. Whitelisting the app from Doze is what
 * stops the drops. See [[bugfix/lu32-audio-interrupciones]].
 *
 * Android-only. iOS has no Doze equivalent (background audio just works), so
 * this is a no-op there.
 */

/** Result of asking the OS to exempt the app from battery optimization. */
export type BatteryOptimizationResult = 'requested' | 'unsupported' | 'error';

/** PURE: build the `package:<id>` intent data the OS needs to target THIS app. */
export function batteryOptimizationData(packageName: string): string {
  return `package:${packageName}`;
}

/**
 * Session-scoped guard: the OS already dismisses the dialog when the app is
 * exempt, but we also avoid re-firing the intent within a single app run.
 */
let alreadyRequested = false;

/** Test-only: reset the once-per-session guard between cases. */
export function __resetBatteryOptimizationGuard(): void {
  alreadyRequested = false;
}

/**
 * Prompt the user to exempt the app from battery optimization. If the app is
 * already exempt Android dismisses the system dialog itself, so this is safe to
 * call repeatedly. Fire-and-forget from the caller — the returned promise only
 * settles when the user comes back from the system screen.
 *
 * @param force bypass the once-per-session auto guard. The automatic prompt on
 *   playback start is guarded so it fires at most once per run; an explicit user
 *   action (the "Activar" banner) passes `force: true` to always re-open it.
 */
export async function requestIgnoreBatteryOptimizations(
  { force = false }: { force?: boolean } = {},
): Promise<BatteryOptimizationResult> {
  if (Platform.OS !== 'android') return 'unsupported';
  if (alreadyRequested && !force) return 'requested';

  const packageName = Constants.expoConfig?.android?.package;
  if (!packageName) return 'error';

  try {
    await startActivityAsync(ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: batteryOptimizationData(packageName),
    });
    alreadyRequested = true;
    return 'requested';
  } catch {
    return 'error';
  }
}
