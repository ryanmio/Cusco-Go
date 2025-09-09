import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet, AppState } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addCapturesListener, listDistinctCapturedItemIds } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';
import { authenticateGameCenter, submitTotalScore } from '@/lib/leaderboard';

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

  useEffect(() => {
    // Best-effort authenticate to Game Center on mount (iOS only)
    authenticateGameCenter();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        authenticateGameCenter();
        const idToDifficulty = new Map(HUNT_ITEMS.map((i) => [i.id, i.difficulty] as const));
        const total = capturedIds.reduce((sum, id) => sum + (idToDifficulty.get(id) ?? 0), 0);
        (async () => {
          await submitTotalScore(total);
        })();
      }
    });
    return () => sub.remove();
  }, [capturedIds]);

  const totalPoints = useMemo(() => {
    if (!capturedIds.length) return 0;
    const idToDifficulty = new Map(HUNT_ITEMS.map((i) => [i.id, i.difficulty] as const));
    return capturedIds.reduce((sum, id) => sum + (idToDifficulty.get(id) ?? 0), 0);
  }, [capturedIds]);

  useEffect(() => {
    if (!capturedIds.length) return;
    const idToDifficulty = new Map(HUNT_ITEMS.map((i) => [i.id, i.difficulty] as const));
    const total = capturedIds.reduce((sum, id) => sum + (idToDifficulty.get(id) ?? 0), 0);
    (async () => {
      await submitTotalScore(total);
    })();
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


