import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, router } from 'expo-router';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Stack } from 'expo-router';
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
    <NativeTabs>
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
