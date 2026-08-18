import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isBackgroundPlaybackAtRisk } from '../../core/audio/backgroundPlayback';
import { requestIgnoreBatteryOptimizations } from '../../core/audio/batteryOptimization';
import { trackEvent } from '../../core/observability/observability';
import { EVENTS } from '../../core/observability/events';

interface BackgroundPlaybackWarning {
  /** Whether to show the notice: the app is at risk (not exempt from Doze). */
  visible: boolean;
  /** Open the exemption dialog, then re-check when the user returns. */
  enable: () => void;
}

/**
 * Drives the background-playback warning. Re-checks the exemption whenever the
 * app returns to the foreground, so the notice clears itself the moment the app
 * is actually exempt — no restart needed. The notice is NOT dismissible: it
 * stays until the OS reports the app exempt, since a single grant can land on
 * "Optimizado" (still not enough for cellular) on some OEMs.
 */
export function useBackgroundPlaybackWarning(): BackgroundPlaybackWarning {
  const [atRisk, setAtRisk] = useState(false);

  const refresh = useCallback(async () => {
    setAtRisk(await isBackgroundPlaybackAtRisk());
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const enable = useCallback(() => {
    // Explicit user action → force past the once-per-session auto guard.
    void requestIgnoreBatteryOptimizations({ force: true }).then(async () => {
      const stillAtRisk = await isBackgroundPlaybackAtRisk();
      setAtRisk(stillAtRisk);
      // Reported only on this deliberate path, not on every foreground re-check:
      // what we want to know is how often asking actually works. Some OEMs land
      // the grant on "Optimizado", which reads as granted but is not enough.
      trackEvent(EVENTS.BATTERY_EXEMPTION, { granted: !stillAtRisk });
    });
  }, []);

  return { visible: atRisk, enable };
}
