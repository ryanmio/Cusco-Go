import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import GlassSurface from '@/components/GlassSurface';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function CaptureCard({ id, title, placeholder, thumbnailUri, onPress }: { id: string; title: string; placeholder: any; thumbnailUri?: string | null; onPress: () => void }) {
  const thumbSource = thumbnailUri ? { uri: thumbnailUri } : placeholder;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <GlassSurface
        style={styles.imageWrap}
        glassEffectStyle="regular"
        isInteractive
        fallbackStyle={{
          backgroundColor: colors.cardBackground,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
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

