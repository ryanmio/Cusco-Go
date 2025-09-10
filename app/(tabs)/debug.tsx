import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Platform, ScrollView, Alert } from 'react-native';
import { authenticateGameCenter, getLocalPlayer, isGameCenterAvailable, showLeaderboards, submitTestScoreOne } from '@/lib/leaderboard';

export default function DebugScreen() {
  const [available, setAvailable] = useState<boolean>(false);
  const [player, setPlayer] = useState<any>(null);
  const [lastAction, setLastAction] = useState<string>('');

  async function refresh() {
    setAvailable(isGameCenterAvailable());
    const p = await getLocalPlayer();
    setPlayer(p);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Game Center Debug</Text>
      <Text>Platform: {Platform.OS}</Text>
      <Text>Available: {String(available)}</Text>
      <Text>Player: {player ? JSON.stringify(player) : 'null'}</Text>
      <Text>Last action: {lastAction}</Text>

      <View style={styles.row}>
        <Button title="Authenticate" onPress={async () => { setLastAction('authenticate'); await authenticateGameCenter(); await refresh(); }} />
      </View>
      <View style={styles.row}>
        <Button title="Submit Test Score (1)" onPress={async () => { setLastAction('submit 1'); const ok = await submitTestScoreOne(); if (!ok) Alert.alert('Game Center', 'Submit failed'); }} />
      </View>
      <View style={styles.row}>
        <Button title="Show Leaderboard" onPress={async () => { setLastAction('show leaderboard'); const ok = await showLeaderboards(); if (!ok) Alert.alert('Game Center', 'Leaderboards unavailable'); }} />
      </View>
      <View style={styles.row}>
        <Button title="Refresh" onPress={refresh} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  h1: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  row: { marginTop: 8 },
});


