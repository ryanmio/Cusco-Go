import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, router } from 'expo-router';
import { Pressable } from 'react-native';
import PointsTally from '@/components/PointsTally';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
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
              color={Colors[colorScheme ?? 'light'].tabIconDefault}
            />
          </Pressable>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hunt',
          headerTitle: 'Hunt',
          headerRight: () => <PointsTally />,
          tabBarIcon: ({ color }) => <TabBarIcon name="image" color={color} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          headerTitle: 'Gallery',
          headerRight: () => <PointsTally />,
          tabBarIcon: ({ color }) => <TabBarIcon name="th" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerTitle: 'Map',
          headerRight: () => <PointsTally />,
          tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} />,
        }}
      />
    </Tabs>
  );
}
