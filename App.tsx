import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ConexionIntro } from './src/ui/organisms/intro/ConexionIntro';
import { loadRemoteConfig } from './src/core/config/remoteConfig';
import { initAudio, play, teardownAudio } from './src/core/audio/audioService';
import { usePlayerStore } from './src/core/store/playerStore';
import { shouldRevealApp } from './src/core/store/appReadiness';

const queryClient = new QueryClient();

/**
 * Hard cap so a dead/slow network never strands the user on the splash. If audio
 * hasn't reached 'playing' by now, reveal anyway (they'll see buffering/retry).
 */
const MAX_SPLASH_MS = 8000;

export default function App() {
  const playerState = usePlayerStore((s) => s.state);
  // The intro animation has played out (minimum on-screen time).
  const [animationDone, setAnimationDone] = useState(false);
  // App revealed → swap the splash for the navigator.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Boot the audio engine, then start playback IMMEDIATELY so the stream buffers
    // UNDER the splash instead of flashing a "loading" state after it. Failures
    // surface through the player's error/retry UI, so we don't block on them.
    let cancelled = false;
    void (async () => {
      const { streamUrl, stationLogoUrl } = await loadRemoteConfig();
      if (cancelled) return;
      await initAudio(streamUrl, stationLogoUrl);
      if (cancelled) return;
      play();
    })().catch(() => undefined);
    // Release the native player and the connectivity subscription. A boot still
    // in flight cannot re-create them afterwards: teardownAudio invalidates the
    // init generation, so an initAudio resuming from an await bails out.
    return () => {
      cancelled = true;
      teardownAudio();
    };
  }, []);

  // Reveal once the animation has played AND the stream is truly playing (or has
  // errored). Until then the splash covers the buffering.
  useEffect(() => {
    if (shouldRevealApp(animationDone, playerState)) setReady(true);
  }, [animationDone, playerState]);

  // Safety net: never keep the splash up longer than the hard cap.
  useEffect(() => {
    const cap = setTimeout(() => setReady(true), MAX_SPLASH_MS);
    return () => clearTimeout(cap);
  }, []);

  const handleIntroFinish = useCallback(() => setAnimationDone(true), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* Dark icons over the white intro; light icons over the dark app. */}
          <StatusBar style={ready ? 'light' : 'dark'} />
          {ready ? (
            <RootNavigator />
          ) : (
            <ConexionIntro onFinish={handleIntroFinish} />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
