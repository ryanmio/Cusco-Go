import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import GlassSurface from '@/components/GlassSurface';
import { getLatestCaptureForItem } from '@/lib/db';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function CaptureCard({ id, title, placeholder, onPress }: { id: string; title: string; placeholder: any; onPress: () => void }) {
  const latest = getLatestCaptureForItem(id);
  const thumbSource = latest ? { uri: latest.thumbnailUri } : placeholder;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <GlassSurface style={styles.imageWrap} glassEffectStyle="regular" isInteractive>
        <Image source={thumbSource} style={styles.image} resizeMode="cover" />
      </GlassSurface>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 8 },
  imageWrap: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  title: { marginTop: 6, fontWeight: '600', fontSize: 14, textAlign: 'center' },
});

