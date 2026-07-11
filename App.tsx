import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { loadRemoteConfig } from './src/core/config/remoteConfig';
import { initAudio } from './src/core/audio/audioService';

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    // Boot the audio engine with the (remote-config) stream URL. Failures surface
    // through the player's error/retry UI, so we don't block the app on them.
    void (async () => {
      const { streamUrl } = await loadRemoteConfig();
      await initAudio(streamUrl);
    })().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
