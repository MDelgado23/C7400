import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/ui/organisms/SplashScreen';
import { loadRemoteConfig } from './src/core/config/remoteConfig';
import { initAudio, play } from './src/core/audio/audioService';

const queryClient = new QueryClient();

export default function App() {
  // Gate the app behind the loading splash. `ready` flips once the splash
  // animation finishes and playback has been kicked off.
  const [ready, setReady] = useState(false);
  // The audio-engine boot, kept as a promise so the splash can await it before
  // autoplaying — the player can't `play()` until `initAudio` has created it.
  const audioReady = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // Boot the audio engine with the (remote-config) stream URL. Failures surface
    // through the player's error/retry UI, so we don't block the app on them.
    audioReady.current = (async () => {
      const { streamUrl } = await loadRemoteConfig();
      await initAudio(streamUrl);
    })().catch(() => undefined);
  }, []);

  // When the splash animation ends: make sure the engine is initialized, then
  // start playback automatically and reveal the app.
  const handleSplashFinish = useCallback(() => {
    void (async () => {
      await audioReady.current;
      play();
      setReady(true);
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
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
