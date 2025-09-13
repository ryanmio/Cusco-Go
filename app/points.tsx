import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addCapturesListener, listDistinctCapturedItemIds } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>No points yet</Text>
          <Text style={[styles.emptySubText, { color: colors.text }]}>Capture items to earn points.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={entries}
          keyExtractor={(e) => e.itemId}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.formula, { color: colors.text }]}>
                {item.multiplier} x {item.difficulty} = {item.points}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
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


