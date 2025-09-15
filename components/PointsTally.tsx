import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addCapturesListener, listDistinctCapturedItemIds, listAllBonuses, listCaptures } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';

export function PointsTally() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [capturedIds, setCapturedIds] = useState<string[]>([]);
  const [bonusTotal, setBonusTotal] = useState<number>(0);

  function refresh() {
    const ids = listDistinctCapturedItemIds();
    setCapturedIds(ids);
    const caps = listCaptures();
    const bonuses = listAllBonuses();
    const capIds = new Set(caps.map(c => c.id));
    const sum = bonuses.reduce((s, b) => s + (capIds.has(b.captureId) ? Math.max(0, b.bonusPoints) : 0), 0);
    setBonusTotal(sum);
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
    const base = (() => {
      if (!capturedIds.length) return 0;
      const idToDifficulty = new Map(HUNT_ITEMS.map((i) => [i.id, i.difficulty] as const));
      return capturedIds.reduce((sum, id) => sum + (idToDifficulty.get(id) ?? 0), 0);
    })();
    return base + bonusTotal;
  }, [capturedIds, bonusTotal]);

  return (
    <Pressable onPress={() => router.push('/points')} accessibilityRole="button" accessibilityLabel="View points breakdown">
      <View style={styles.container}>
        <Text style={[styles.text, { color: colors.text }]} accessibilityLabel="Total points">
          {totalPoints}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12 },
  text: { fontSize: 16, fontWeight: '600' },
});

export default PointsTally;


