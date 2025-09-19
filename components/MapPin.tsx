import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassSurface from '@/components/GlassSurface';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export type MapPinProps = {
  label?: string;
  count?: number; // when > 1, render a cluster chip
  useGlass?: boolean; // when false, render a solid chip (perf)
};

export function MapPin({ label, count, useGlass = true }: MapPinProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const textColor = colors.text;
  const glassTint = (colorScheme === 'dark') ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.16)';
  const fallbackGlass = (colorScheme === 'dark') ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';
  const accent = colors.tint;

  const isCluster = typeof count === 'number' && count > 1;

  return (
    <View style={styles.container} pointerEvents="none">
      {useGlass ? (
        <GlassSurface
          style={[styles.chip, isCluster && styles.clusterChip]}
          glassEffectStyle="regular"
          isInteractive={false}
          tintColor={glassTint}
          fallbackStyle={{ backgroundColor: fallbackGlass }}
          useHaloFix
        >
          {isCluster ? (
            <Text style={[styles.clusterLabel, { color: textColor }]}>{count}</Text>
          ) : (
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {label}
            </Text>
          )}
        </GlassSurface>
      ) : (
        <View style={[styles.chip, isCluster && styles.clusterChip, { backgroundColor: fallbackGlass }]}>
          {isCluster ? (
            <Text style={[styles.clusterLabel, { color: textColor }]}>{count}</Text>
          ) : (
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {label}
            </Text>
          )}
        </View>
      )}
      <View style={[styles.stem, { backgroundColor: accent }]} />
      <View style={[styles.dotOuter, { backgroundColor: accent }]}>
        <View style={styles.dotInner} />
      </View>
    </View>
  );
}

export default MapPin;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  chip: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 220,
  },
  clusterChip: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  clusterLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  stem: {
    width: 2,
    height: 10,
    marginTop: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  dotOuter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.95,
  },
  dotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
});


