import { StyleSheet, ScrollView, View, Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HowToPlayScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';

  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const subtle = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
  const hairline = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>How to Play</Text>
      <Text style={[styles.subtitle, { color: subtle }]}>A location-based photo hunt across Peru • Offline app, no internet required</Text>

      <View style={[styles.section, { backgroundColor: cardBg, borderColor: hairline }]}>
        <Text style={[styles.h3, { color: colors.text }]}>Photo scavenger hunt 📷</Text>
        <Text style={[styles.p, { color: colors.text }]}>There are 24 cultural or ecologically significant animals, plants, and ruins to document using your phone camera.</Text>
        <View style={styles.bulletBlock}>
          <Text style={[styles.bullet, { color: colors.text }]}>• Open the Hunt tab to see the full list.</Text>
          <Text style={[styles.bullet, { color: colors.text }]}>• Tap any item, then take a photo or pick one from your library.</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: cardBg, borderColor: hairline }]}>
        <Text style={[styles.h3, { color: colors.text }]}>Scoring and bonus zones 🎯</Text>
        <Text style={[styles.p, { color: colors.text }]}>Earn points for each unique capture. Your score increases faster in certain places.</Text>
        <View style={styles.bulletBlock}>
          <Text style={[styles.bullet, { color: colors.text }]}>• Capturing in bonus zones applies a multiplier to your points.</Text>
          <Text style={[styles.bullet, { color: colors.text }]}>• The Map shows some well-known bonus zones so you can plan your route.</Text>
          <Text style={[styles.bullet, { color: colors.text }]}>• Additional surprise bonus zones are scattered around Peru.</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: cardBg, borderColor: hairline }]}>
        <Text style={[styles.h3, { color: colors.text }]}>The goal 🏆</Text>
        <Text style={[styles.p, { color: colors.text }]}>Get the highest total by the end of your trip to Peru. Compete by sharing your score and gallery with friends.</Text>
      </View>

      <View style={[styles.section, { backgroundColor: cardBg, borderColor: hairline }]}>
        <Text style={[styles.h3, { color: colors.text }]}>Your gallery 🖼️</Text>
        <View style={styles.bulletBlock}>
          <Text style={[styles.bullet, { color: colors.text }]}>• The Gallery page lists all of your captures.</Text>
          <Text style={[styles.bullet, { color: colors.text }]}>• Photos taken through the app are full resolution and automatically saved to your device.</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: cardBg, borderColor: hairline }]}>
        <Text style={[styles.h3, { color: colors.text }]}>Helpful tips 🧭</Text>
        <View style={styles.bulletBlock}>
          <Text style={[styles.bullet, { color: colors.text }]}>• Allow location access when prompted. This is used for the bonus zones.</Text>
          <Text style={[styles.bullet, { color: colors.text }]}>• Check the Map tab to spot nearby known bonus zones.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 16 },
  section: { marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  h3: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  p: { fontSize: 16, lineHeight: 22 },
  bulletBlock: { marginTop: 2 },
  bullet: { fontSize: 16, lineHeight: 22 },
});


