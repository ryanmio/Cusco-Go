import { StyleSheet, ScrollView, View, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HowToPlayScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>How to Play</Text>
      <View style={styles.section}>
        <Text style={[styles.h3, { color: colors.text }]}>Goal</Text>
        <Text style={[styles.p, { color: colors.text }]}>Explore and capture photos of the listed items around Cusco. Earn points as you go!</Text>
      </View>
      <View style={styles.section}>
        <Text style={[styles.h3, { color: colors.text }]}>Steps</Text>
        <Text style={[styles.p, { color: colors.text }]}>
          1. Browse the Hunt tab to see all items.
        </Text>
        <Text style={[styles.p, { color: colors.text }]}>
          2. Tap an item to capture a photo or view details.
        </Text>
        <Text style={[styles.p, { color: colors.text }]}>
          3. Use your camera or pick from library. Location will be attached when possible.
        </Text>
        <Text style={[styles.p, { color: colors.text }]}>
          4. Earn points for each unique capture. View totals at the top.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={[styles.h3, { color: colors.text }]}>Tips</Text>
        <Text style={[styles.p, { color: colors.text }]}>- Use the search and filters to find items faster.</Text>
        <Text style={[styles.p, { color: colors.text }]}>- Check the Map tab to see where you’ve captured items.</Text>
        <Text style={[styles.p, { color: colors.text }]}>- Share your best shots from the item pages.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16 },
  section: { marginBottom: 18 },
  h3: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  p: { fontSize: 16, lineHeight: 22 },
});


