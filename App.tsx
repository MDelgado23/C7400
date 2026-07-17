import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/ui/organisms/SplashScreen';
import { loadRemoteConfig } from './src/core/config/remoteConfig';
import { initAudio, play } from './src/core/audio/audioService';
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
  // The splash's intro animation has played out (minimum on-screen time).
  const [animationDone, setAnimationDone] = useState(false);
  // App revealed → swap the splash for the navigator.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Boot the audio engine, then start playback IMMEDIATELY so the stream buffers
    // UNDER the splash instead of flashing a "loading" state after it. Failures
    // surface through the player's error/retry UI, so we don't block on them.
    void (async () => {
      const { streamUrl, stationLogoUrl } = await loadRemoteConfig();
      await initAudio(streamUrl, stationLogoUrl);
      play();
    })().catch(() => undefined);
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

  const handleSplashFinish = useCallback(() => setAnimationDone(true), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* Dark icons over the white splash; light icons over the dark app. */}
          <StatusBar style={ready ? 'light' : 'dark'} />
          {ready ? (
            <RootNavigator />
          ) : (
            <SplashScreen onFinish={handleSplashFinish} />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
