import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = (colorScheme ?? 'light') === 'dark';
  const canUseLiquidGlass = isLiquidGlassAvailable();
  const fallbackBackground = isDark ? '#0b0b0b' : '#ffffff';
  const fallbackShadow = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  if (canUseLiquidGlass) {
    return (
      <NativeTabs
        backgroundColor={null}
        shadowColor={undefined}
        disableTransparentOnScrollEdge={undefined}
      >
        <NativeTabs.Trigger name="index">
          <Icon sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }} />
          <Label>Hunt</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="gallery">
          <Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
          <Label>Gallery</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="map">
          <Icon sf={{ default: 'map', selected: 'map.fill' }} />
          <Label>Map</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const colors = Colors[colorScheme ?? 'light'];
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: fallbackBackground,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          shadowColor: fallbackShadow,
          shadowOpacity: 1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
          elevation: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hunt',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="clone" color={color as string} size={size ?? 22} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="th-large" color={color as string} size={size ?? 22} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="map" color={color as string} size={size ?? 22} />
          ),
        }}
      />
    </Tabs>
  );
}
