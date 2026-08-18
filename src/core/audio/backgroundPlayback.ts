import { Platform } from 'react-native';
import * as Battery from 'expo-battery';

/**
 * backgroundPlayback — detects whether the OS is likely to interrupt background
 * audio because the app is NOT exempt from battery optimization (Doze).
 *
 * This is the diagnostic behind the in-app warning: when the user declines the
 * exemption, live playback still drops with the screen off (verified root
 * cause — see [[bugfix/lu32-audio-interrupciones]]). Rather than fail silently,
 * the player surfaces a notice with a one-tap fix.
 */

/**
 * PURE: given whether Android battery-optimization is enabled for the app, is
 * background playback at risk? `null` = the OS couldn't tell (or non-Android):
 * treat as not-at-risk so we never nag on an unknown signal.
 */
export function backgroundPlaybackAtRisk(optimizationEnabled: boolean | null): boolean {
  return optimizationEnabled === true;
}

/**
 * Android-only check: is background playback at risk right now? Other platforms
 * have no Doze equivalent (iOS keeps the `audio` background mode alive), so this
 * is always false there. Swallows errors → unknown means "don't warn".
 */
export async function isBackgroundPlaybackAtRisk(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const optimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
    return backgroundPlaybackAtRisk(optimizationEnabled);
  } catch {
    return false;
  }
}
