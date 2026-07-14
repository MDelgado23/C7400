import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isBackgroundPlaybackAtRisk } from '../../core/audio/backgroundPlayback';
import { requestIgnoreBatteryOptimizations } from '../../core/audio/batteryOptimization';

interface BackgroundPlaybackWarning {
  /** Whether to show the notice: at risk AND not dismissed this session. */
  visible: boolean;
  /** Open the exemption dialog, then re-check when the user returns. */
  enable: () => void;
  /** Hide the notice for this session. */
  dismiss: () => void;
}

/**
 * Drives the background-playback warning. Re-checks the exemption whenever the
 * app returns to the foreground, so the notice clears itself the moment the user
 * grants it in system settings — no restart needed.
 */
export function useBackgroundPlaybackWarning(): BackgroundPlaybackWarning {
  const [atRisk, setAtRisk] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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
    void requestIgnoreBatteryOptimizations({ force: true }).then(refresh);
  }, [refresh]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { visible: atRisk && !dismissed, enable, dismiss };
}
