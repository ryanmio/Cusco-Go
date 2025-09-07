import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getLatestCaptureForItem } from '@/lib/db';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function CaptureCard({ id, title, placeholder, onPress }: { id: string; title: string; placeholder: any; onPress: () => void }) {
  const latest = getLatestCaptureForItem(id);
  const thumbSource = latest ? { uri: latest.thumbnailUri } : placeholder;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <Pressable style={[styles.card, { backgroundColor: colors.cardBackground }]} onPress={onPress}>
      <Image source={thumbSource} style={styles.image} resizeMode="cover" />
      <View style={[styles.caption, { backgroundColor: colors.overlayBackground }]}>
        <Text style={[styles.captionText, { color: colors.overlayText }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, aspectRatio: 1, margin: 8, borderRadius: 12, overflow: 'hidden' },
  image: { flex: 1, width: '100%', height: '100%' },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 6 },
  captionText: { fontWeight: '600' },
});

