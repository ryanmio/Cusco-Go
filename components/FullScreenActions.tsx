import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassSurface from '@/components/GlassSurface';

export function FullScreenActions({ onSave, onShare, onDelete }: { onSave: () => void; onShare: () => void; onDelete: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <GlassSurface glassEffectStyle="regular" isInteractive style={styles.bar}>
        <Pressable onPress={onDelete} style={styles.btn}><Text style={styles.text}>Delete</Text></Pressable>
        <Pressable onPress={onSave} style={styles.btn}><Text style={styles.text}>Save</Text></Pressable>
        <Pressable onPress={onShare} style={styles.btn}><Text style={styles.text}>Share</Text></Pressable>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  bar: { height: 56, flexDirection: 'row', borderRadius: 16, overflow: 'hidden' },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: 'white', fontWeight: '700' },
});

