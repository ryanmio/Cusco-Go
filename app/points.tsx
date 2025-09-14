import React, { useEffect, useMemo, useState } from 'react';
import { Animated, FlatList, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addCapturesListener, listDistinctCapturedItemIds } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';
import GlassSurface from '@/components/GlassSurface';

type PointsEntry = {
  itemId: string;
  title: string;
  difficulty: number;
  multiplier: number; // placeholder for future location-based multiplier
  points: number;
};

export default function PointsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [capturedIds, setCapturedIds] = useState<string[]>([]);
  const scrollY = React.useRef(new Animated.Value(0)).current;

  function refresh() {
    const ids = listDistinctCapturedItemIds();
    setCapturedIds(ids);
  }

  useEffect(() => {
    refresh();
    const unsubscribe = addCapturesListener(() => refresh());
    return unsubscribe;
  }, []);

  const idToItem = useMemo(() => new Map(HUNT_ITEMS.map((i) => [i.id, i])), []);
  const maxTotal = useMemo(() => HUNT_ITEMS.reduce((sum, i) => sum + i.difficulty, 0), []);

  const entries: PointsEntry[] = useMemo(() => {
    const multiplier = 1; // TODO: replace with location-based multiplier per item
    const list = capturedIds
      .map((id) => idToItem.get(id))
      .filter(Boolean)
      .map((item) => {
        const difficulty = (item as any).difficulty as number;
        return {
          itemId: (item as any).id as string,
          title: (item as any).title as string,
          difficulty,
          multiplier,
          points: multiplier * difficulty,
        } as PointsEntry;
      });
    // Sort by points descending, then by title as a tiebreaker
    return list.sort((a, b) => (b.points - a.points) || a.title.localeCompare(b.title));
  }, [capturedIds, idToItem]);

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.points, 0), [entries]);

  const progress = maxTotal > 0 ? Math.max(0, Math.min(1, total / maxTotal)) : 0;
  const scale = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0.55], extrapolate: 'clamp' });
  const cardHeight = scrollY.interpolate({ inputRange: [0, 150], outputRange: [170, 80], extrapolate: 'clamp' });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>No points yet</Text>
          <Text style={[styles.emptySubText, { color: colors.text }]}>Capture items to earn points.</Text>
        </View>
      ) : (
        <Animated.FlatList
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          contentContainerStyle={[styles.list, { paddingTop: 210 }]}
          data={entries}
          keyExtractor={(e) => e.itemId}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.formula, { color: colors.text }]}>
                {item.multiplier} x {item.difficulty} = {item.points} pts
              </Text>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>TOTAL</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{total}</Text>
            </View>
          }
        />
      )}
      <Animated.View style={[styles.glassWrapper, { height: cardHeight }]} pointerEvents="none">
        <GlassSurface
          style={[
            styles.glassCard,
            {
              borderColor: (colorScheme === 'dark') ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)',
              borderWidth: 1,
            },
          ]}
          glassEffectStyle="regular"
          isInteractive
          fallbackStyle={{ backgroundColor: (colorScheme === 'dark') ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.28)' }}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <ProgressDonut 
              size={126}
              strokeWidth={10}
              progress={progress}
              trackColor={colors.border}
              fillStart="#F59E0B"
              fillEnd={Colors[colorScheme ?? 'light'].tint}
              label={`${Math.round(progress * 100)}%`}
              sublabel={`${total} / ${maxTotal} pts`}
              textColor={colors.text}
            />
          </Animated.View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

function ProgressDonut({
  size,
  strokeWidth,
  progress,
  trackColor,
  fillStart,
  fillEnd,
  label,
  sublabel,
  textColor,
  textOpacity,
}: {
  size: number;
  strokeWidth: number;
  progress: number; // 0..1
  trackColor: string;
  fillStart: string;
  fillEnd: string;
  label: string;
  sublabel?: string;
  textColor: string;
  textOpacity?: any;
}) {
  const half = size / 2;
  const radius = half - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;
  const gap = circumference - dash;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={fillStart} />
            <Stop offset="100%" stopColor={fillEnd} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={half}
          cy={half}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={half}
          cy={half}
          r={radius}
          stroke="url(#grad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash}, ${gap}`}
          rotation={-90}
          origin={`${half}, ${half}`}
          fill="none"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: textColor, fontSize: 20, fontWeight: '800' }}>{label}</Text>
        {sublabel ? (
          <Text style={{ color: textColor, opacity: 0.7, marginTop: 2, fontWeight: '600' }}>{sublabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 64 },
  chartContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 16, paddingBottom: 8 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glassWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glassCard: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    bottom: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  formula: { fontSize: 16, fontWeight: '600' },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: 16, fontWeight: '800' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubText: { fontSize: 14, opacity: 0.7 },
});


