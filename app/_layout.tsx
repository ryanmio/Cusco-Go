import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Pressable } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
// Note: Lazy import Updates only in production/dev-client builds to avoid native module errors in environments where it's unavailable
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { CelebrationProvider } from '@/components/CelebrationProvider';
import PointsTally from '@/components/PointsTally';
import Colors from '@/constants/Colors';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Ensure devices fetch the latest JS bundle when an update is published
  useEffect(() => {
    async function maybeFetchUpdate() {
      try {
        const Updates = await import('expo-updates');
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Silently ignore when Updates isn't available (e.g., Simulator/dev-only env)
      }
    }
    // Only run on non-development JS environments
    if (!__DEV__) {
      // Fire and forget; avoid blocking UI
      maybeFetchUpdate();
    }
  }, []);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <CelebrationProvider>
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerTitle: 'Hunt',
              headerLeft: () => (
                <Pressable
                  onPress={() => router.push('/how-to-play')}
                  style={{ paddingHorizontal: 10, opacity: 0.7 }}
                  hitSlop={8}
                  accessibilityLabel="How to Play"
                  accessibilityRole="button"
                >
                  <FontAwesome name="question-circle" size={18} />
                </Pressable>
              ),
              headerRight: () => <PointsTally />,
            }}
          />
          <Stack.Screen
            name="viewer"
            options={{
              title: 'Viewer',
              headerShown: false,
              presentation: 'card',
              contentStyle: { backgroundColor: 'black' },
            }}
          />
          <Stack.Screen name="item/[id]" options={{ title: 'Item Details', headerBackTitle: 'Back' }} />
          <Stack.Screen name="points" options={{ title: 'Points', headerBackTitle: 'Back' }} />
          <Stack.Screen name="how-to-play" options={{ title: 'How to Play', headerBackTitle: 'Back' }} />
        </Stack>
      </CelebrationProvider>
    </ThemeProvider>
  );
}
