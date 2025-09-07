import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { listCaptures, CaptureRow } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function GalleryScreen() {
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    setRows(listCaptures());
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setRows(listCaptures());
    }, [])
  );

  const itemIdToTitle = Object.fromEntries(HUNT_ITEMS.map(i => [i.id, i.title]));

  function onImagePress(item: CaptureRow) {
    router.push(`/item/${item.itemId}`);
  }

  function renderImage({ item }: { item: CaptureRow }) {
    return (
      <Pressable style={[styles.imageContainer, { backgroundColor: colors.cardBackground }]} onPress={() => onImagePress(item)}>
        <Image source={{ uri: item.thumbnailUri }} style={styles.image} resizeMode="cover" />
        <View style={[styles.overlay, { backgroundColor: colors.overlayBackground }]}>
          <Text style={[styles.title, { color: colors.overlayText }]}>{itemIdToTitle[item.itemId] ?? item.title}</Text>
          <Text style={[styles.date, { color: colors.overlayText }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      </Pressable>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.text }]}>No photos captured yet</Text>
        <Text style={[styles.emptySubtext, { color: colors.searchPlaceholder }]}>Start hunting to see your gallery!</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      data={rows}
      keyExtractor={(r) => String(r.id)}
      numColumns={2}
      renderItem={renderImage}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 8 },
  imageContainer: { flex: 1, aspectRatio: 1, margin: 4, borderRadius: 12, overflow: 'hidden' },
  image: { flex: 1, width: '100%', height: '100%' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8 },
  title: { fontWeight: '600', fontSize: 14 },
  date: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
});

