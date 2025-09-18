import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Pressable, Image, Animated } from 'react-native';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { setSetting, ONBOARDED_KEY } from '@/lib/db';
import GlassSurface from '@/components/GlassSurface';

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';
  const subtle = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
  // Configurable glass settings per theme
  type GlassCfg = { tint: string; style: 'regular' | 'clear' };
  type PillCfg = GlassCfg & { textColor: string };

  // Tweak these four constants to tune onboarding appearance per theme
  const CARD_LIGHT: GlassCfg = { tint: 'rgba(45, 18, 18, 0.71)', style: 'clear' };
  const CARD_DARK: GlassCfg = { tint: 'rgba(26, 11, 11, 0.71)', style: 'clear' };
  const PILL_LIGHT: PillCfg = { tint: 'rgba(130, 63, 63, 0.44)', style: 'clear', textColor: '#fff' };
  const PILL_DARK: PillCfg = { tint: 'rgba(45, 18, 18, 0.71)', style: 'clear', textColor: '#fff' };

  const cardGlass = isDark ? CARD_DARK : CARD_LIGHT;
  const pillGlass = isDark ? PILL_DARK : PILL_LIGHT;

  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [bgReady, setBgReady] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;

  // Background sizing to ensure image covers screen while staying centered
  const { width: screenW, height: screenH } = useWindowDimensions();
  const pattern = require('../assets/images/pattern.webp');
  const patternSource = Image.resolveAssetSource(pattern);
  const imgAR = (patternSource?.width && patternSource?.height) ? (patternSource.width / patternSource.height) : 1;
  const screenAR = screenW / screenH;
  const bgSize = useMemo(() => {
    if (!patternSource?.width || !patternSource?.height) {
      return { width: screenW, height: screenH };
    }
    if (imgAR > screenAR) {
      // Image is wider than the screen: match height, expand width
      return { width: screenH * imgAR, height: screenH };
    }
    // Image is taller than the screen: match width, expand height
    return { width: screenW, height: screenW / imgAR };
  }, [screenW, screenH, imgAR, patternSource?.width, patternSource?.height]);

  // Consistent card height across pages, clamped for small/large screens
  const cardHeight = useMemo(() => {
    const proposed = screenH * 0.22; // ~42% of viewport height
    const minH = 260;
    const maxH = 460;
    return Math.round(Math.max(minH, Math.min(maxH, proposed)));
  }, [screenH]);


  const pages = useMemo(
    () => [
      {
        title: 'Get Ready',
        emoji: '📷',
        body:
          'There are 24 culturally or ecologically significant animals, plants, and ruins to document with your camera.',
      },
      {
        title: 'Bonus zones',
        emoji: '🎯',
        body:
          'Bonus zones across Peru boost your score. Some are mapped, some are surprises.',
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
      {/* Fade-in layer to avoid flash */}
      <Animated.View style={[StyleSheet.absoluteFillObject as any, { opacity: bgReady ? reveal : 0 }]}> 
        {/* Background pattern to showcase Liquid Glass */}
        <View style={styles.bgWrap} pointerEvents="none">
          <Image
            source={pattern}
            style={{ width: bgSize.width, height: bgSize.height }}
            resizeMode="cover"
            fadeDuration={0}
            blurRadius={0}
            onLoadEnd={() => {
              if (!bgReady) {
                setBgReady(true);
                Animated.timing(reveal, { toValue: 1, duration: 220, useNativeDriver: true }).start();
              }
            }}
          /> 
        </View>
      {/* Spacer to preserve layout after removing Skip */}
      <View style={styles.header} />

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
              <GlassSurface style={[styles.card, { height: cardHeight }]} glassEffectStyle={cardGlass.style} isInteractive tintColor={cardGlass.tint} useHaloFix>
              <Text style={[styles.emoji]}>{p.emoji}</Text>
                <Text style={[styles.title, { color: '#fff' }]}>{p.title}</Text>
                <Text style={[styles.body, { color: '#fff' }]}>{p.body}</Text>
            </GlassSurface>
          </View>
        ))}
      </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {pages.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
          {index < pages.length - 1 ? (
            <GlassSurface style={styles.glassPill} glassEffectStyle={pillGlass.style} isInteractive tintColor={pillGlass.tint} useHaloFix>
              <Pressable accessibilityRole="button" onPress={goNext} style={styles.pillPress}>
                <Text style={[styles.pillText, { color: pillGlass.textColor }]}>Next</Text>
              </Pressable>
            </GlassSurface>
          ) : (
            <GlassSurface style={styles.glassPill} glassEffectStyle={pillGlass.style} isInteractive tintColor={pillGlass.tint} useHaloFix>
              <Pressable accessibilityRole="button" onPress={finish} style={styles.pillPress}>
                <Text style={[styles.pillText, { color: pillGlass.textColor }]}>Get started</Text>
              </Pressable>
            </GlassSurface>
          )}
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgWrap: { ...StyleSheet.absoluteFillObject as any, alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, alignItems: 'flex-end', justifyContent: 'center' },
  skip: { paddingHorizontal: 16, paddingVertical: 8 },
  skipText: { fontSize: 15 },
  page: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  card: {
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  emoji: { fontSize: 42, marginBottom: 8, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  footer: { padding: 20, gap: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  dotActive: { width: 10, height: 10, backgroundColor: '#2563eb' },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  glassPill: {
    alignSelf: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },
  pillPress: { paddingHorizontal: 20, paddingVertical: 10 },
  pillText: { fontSize: 16, fontWeight: '800' },
});


