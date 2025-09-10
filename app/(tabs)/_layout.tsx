import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Alert, Pressable } from 'react-native';
import PointsTally from '@/components/PointsTally';
import { showLeaderboards } from '@/lib/leaderboard';

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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hunt',
          headerTitle: 'Hunt',
          headerRight: () => (
            <Pressable onPress={async () => { const ok = await showLeaderboards(); if (!ok) { Alert.alert('Game Center', 'Leaderboards unavailable. Ensure you are signed into Game Center and try again.'); } }} accessibilityLabel="Show leaderboards" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PointsTally />
            </Pressable>
          ),
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
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          headerTitle: 'Debug',
          headerRight: () => <PointsTally />,
          tabBarIcon: ({ color }) => <TabBarIcon name="bug" color={color} />,
        }}
      />
    </Tabs>
  );
}
