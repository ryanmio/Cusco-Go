import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Pressable } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { CelebrationProvider } from '@/components/CelebrationProvider';
import PointsTally from '@/components/PointsTally';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Note: avoid forcing initialRouteName here so our onboarding navigation works.
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
  
  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  // Simple, stable hook order: always run this effect and navigate if needed
  useEffect(() => {
    try {
      const { getSetting, ONBOARDED_KEY } = require('@/lib/db');
      const hasOnboarded = getSetting(ONBOARDED_KEY);
      if (!hasOnboarded) {
        router.push('/onboarding');
      }
    } catch (e) {
      // If reading the flag fails, proceed with default route
    }
  }, []);

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
                  <FontAwesome
                    name="question-circle"
                    size={18}
                    color={colorScheme === 'dark' ? '#d1d5db' : undefined}
                  />
                </Pressable>
              ),
              headerRight: () => <PointsTally />,
            }}
          />
          <Stack.Screen
            name="viewer"
            options={{
              title: 'Viewer',
              headerBackTitle: 'Back',
              headerStyle: { backgroundColor: 'black' },
              headerTintColor: 'white',
              headerTitleStyle: { color: 'white' },
              presentation: 'card',
              contentStyle: { backgroundColor: 'black' },
            }}
          />
          <Stack.Screen name="item/[id]" options={{ title: 'Item Details', headerBackTitle: 'Back' }} />
          <Stack.Screen name="points" options={{ title: 'Points', headerBackTitle: 'Back' }} />
          <Stack.Screen name="how-to-play" options={{ title: 'How to Play', headerBackTitle: 'Back' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack>
      </CelebrationProvider>
    </ThemeProvider>
  );
}
