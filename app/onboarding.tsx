import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Pressable } from 'react-native';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { setSetting, ONBOARDED_KEY } from '@/lib/db';

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';
  const subtle = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const hairline = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);


  const pages = useMemo(
    () => [
      {
        title: 'Photo scavenger hunt',
        emoji: '📷',
        body:
          'There are 24 culturally or ecologically significant animals, plants, and ruins to document with your camera. Browse targets, tap one, and capture a photo.',
      },
      {
        title: 'Scoring and bonus zones',
        emoji: '🎯',
        body:
          'Each unique capture earns points. Some places apply multipliers. Known and surprise bonus zones across Peru boost your score.',
      },
      {
        title: 'Offline by design',
        emoji: '📴',
        body:
          'Works without internet. Your captures are saved at full resolution to your device. Compete with friends by sharing your total.',
      },
    ],
    []
  );

  const handleScroll = useCallback(
    (e: any) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(newIndex);
    },
    [width]
  );

  const goNext = useCallback(() => {
    if (index < pages.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    }
  }, [index, pages.length, width]);

  const finish = useCallback(() => {
    try {
      setSetting(ONBOARDED_KEY, 'true');
    } catch {}
    router.replace('/');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>      
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          onPress={finish}
          style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.6 : 0.9 }]}
        >
          <Text style={[styles.skipText, { color: subtle }]}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={{ alignItems: 'stretch' }}
      >
        {pages.map((p, i) => (
          <View key={i} style={[styles.page, { width }]}>            
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: hairline }]}>              
              <Text style={[styles.emoji]}>{p.emoji}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{p.title}</Text>
              <Text style={[styles.body, { color: colors.text }]}>{p.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? '#2563eb' : hairline },
              ]}
            />
          ))}
        </View>
        {index < pages.length - 1 ? (
          <Pressable accessibilityRole="button" onPress={goNext} style={styles.cta}>
            <Text style={styles.ctaText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={finish} style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>Get started</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, alignItems: 'flex-end', justifyContent: 'center' },
  skip: { paddingHorizontal: 16, paddingVertical: 8 },
  skipText: { fontSize: 15 },
  page: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 18,
  },
  emoji: { fontSize: 42, marginBottom: 8, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  footer: { padding: 20, gap: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  cta: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
  ctaPrimary: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  ctaPrimaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
});


