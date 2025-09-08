import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addCapturesListener, listDistinctCapturedItemIds } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';

export function PointsTally() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [capturedIds, setCapturedIds] = useState<string[]>([]);

  function refresh() {
    const ids = listDistinctCapturedItemIds();
    setCapturedIds(ids);
  }

  useEffect(() => {
    // Initial load
    refresh();
    // Subscribe to DB changes
    const unsubscribe = addCapturesListener(() => {
      refresh();
    });
    return unsubscribe;
  }, []);

  const totalPoints = useMemo(() => {
    if (!capturedIds.length) return 0;
    const idToDifficulty = new Map(HUNT_ITEMS.map((i) => [i.id, i.difficulty] as const));
    return capturedIds.reduce((sum, id) => sum + (idToDifficulty.get(id) ?? 0), 0);
  }, [capturedIds]);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: colors.text }]} accessibilityLabel="Total points">
        {totalPoints}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12 },
  text: { fontSize: 16, fontWeight: '600' },
});

export default PointsTally;


