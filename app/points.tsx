import React, { useEffect, useMemo, useState } from 'react';
import { Animated, FlatList, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addCapturesListener, listDistinctCapturedItemIds, listCaptures, listAllBonuses } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';
import GlassSurface from '@/components/GlassSurface';

// We treat base points per item as difficulty. Bonuses are stored per capture and summed.

type PointsEntry = {
  itemId: string;
  title: string;
  base: number;
  bonus: number;
  total: number;
  details?: string; // e.g., "Amazon Jungle ×2.5 → +25"
};

export default function PointsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [version, setVersion] = useState(0);
  const scrollY = React.useRef(new Animated.Value(0)).current;

  function refresh() {
    // Bump version when captures or bonuses change
    setVersion((v) => v + 1);
  }

  useEffect(() => {
    refresh();
    const unsubscribe = addCapturesListener(() => refresh());
    return unsubscribe;
  }, []);

  const idToItem = useMemo(() => new Map(HUNT_ITEMS.map((i) => [i.id, i])), []);
  const maxBaseTotal = useMemo(() => HUNT_ITEMS.reduce((sum, i) => sum + i.difficulty, 0), []);
  const maxTotal = maxBaseTotal;

  const entries: PointsEntry[] = useMemo(() => {
    const distinctIds = listDistinctCapturedItemIds();
    const allCaptures = listCaptures();
    const allBonuses = listAllBonuses();

    // For each captured item, compute base and bonus from the latest capture bonuses (or sum across captures?)
    // We will sum bonuses across all captures for that item to reward multiple biome captures.
    const itemIdToBonus = new Map<string, number>();
    for (const b of allBonuses) {
      const cap = allCaptures.find(c => c.id === b.captureId);
      if (cap) {
        const prev = itemIdToBonus.get(cap.itemId) ?? 0;
        itemIdToBonus.set(cap.itemId, prev + b.bonusPoints);
      }
    }

    const list: PointsEntry[] = distinctIds
      .map((id) => idToItem.get(id))
      .filter(Boolean)
      .map((item) => {
        const base = (item as any).difficulty as number;
        const bonus = itemIdToBonus.get((item as any).id as string) ?? 0;
        const total = base + bonus;
        return {
          itemId: (item as any).id as string,
          title: (item as any).title as string,
          base,
          bonus,
          total,
        } as PointsEntry;
      });
    return list.sort((a, b) => (b.total - a.total) || a.title.localeCompare(b.title));
  }, [version, idToItem]);

  const baseTotal = useMemo(() => entries.reduce((sum, e) => sum + e.base, 0), [entries]);
  const bonusTotal = useMemo(() => entries.reduce((sum, e) => sum + e.bonus, 0), [entries]);
  const total = baseTotal + bonusTotal;

  // Donut progress reflects captured items (count) over total items, independent of bonus
  const capturedCount = entries.length;
  const totalItems = HUNT_ITEMS.length;
  const progress = totalItems > 0 ? Math.max(0, Math.min(1, capturedCount / totalItems)) : 0;

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
              <Text style={[styles.formula, { color: colors.text }]}>Base {item.base} + Bonus {item.bonus} = {item.total} pts</Text>
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
          style={[styles.glassCard]}
          glassEffectStyle="regular"
          isInteractive
          tintColor={(colorScheme === 'dark') ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.16)'}
          fallbackStyle={{ backgroundColor: (colorScheme === 'dark') ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.28)' }}
        >
          <Animated.View style={[styles.headerRow, { transform: [{ scale }] }]}> 
            <ProgressDonut 
              size={96}
              strokeWidth={10}
              progress={progress}
              trackColor={colors.border}
              fillStart="#F59E0B"
              fillEnd={Colors[colorScheme ?? 'light'].tint}
              label={`${Math.round(progress * 100)}%`}
              textColor={colors.text}
            />
            <View style={styles.headerStats}>
              <Text style={[styles.totalBig, { color: colors.text }]}>{total} pts</Text>
              <Text style={[styles.totalLine, { color: colors.text }]}>{baseTotal} base</Text>
              <Text style={[styles.totalLine, { color: colors.text }]}>{bonusTotal} bonus</Text>
            </View>
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
        <Text style={{ color: textColor, fontSize: 18, fontWeight: '800' }}>{label}</Text>
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
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerStats: { justifyContent: 'center' },
  totalBig: { fontSize: 28, fontWeight: '900' },
  totalLine: { fontSize: 14, fontWeight: '700', opacity: 0.85 },
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


