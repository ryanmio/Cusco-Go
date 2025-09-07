import { View, Pressable, Text, StyleSheet } from 'react-native';

export function FullScreenActions({ onSave, onShare, onDelete }: { onSave: () => void; onShare: () => void; onDelete: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onDelete} style={styles.btn}><Text style={styles.text}>Delete</Text></Pressable>
      <Pressable onPress={onSave} style={styles.btn}><Text style={styles.text}>Save</Text></Pressable>
      <Pressable onPress={onShare} style={styles.btn}><Text style={styles.text}>Share</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)' },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: 'white', fontWeight: '700' },
});

