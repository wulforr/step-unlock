import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useBlockerSync } from '@/hooks/use-blocker-sync';
import { useStepsSync } from '@/hooks/use-steps-sync';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // One app-wide Health Connect sync loop; every screen reads the store.
  useStepsSync();
  // Bridge config/steps/spend to the native foreground service.
  useBlockerSync();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
