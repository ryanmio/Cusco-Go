import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type CelebrateOptions = {
  delayMs?: number;
  message?: string;
};

type BonusCelebrateOptions = {
  delayMs?: number;
  message: string; // required for bonus to show biome label and points
};

type CelebrationApi = {
  celebrate: (options?: CelebrateOptions) => void;
  celebrateBonus: (options: BonusCelebrateOptions) => void;
};

const CelebrationContext = createContext<CelebrationApi>({ celebrate: () => {}, celebrateBonus: () => {} });

export function useCelebration(): CelebrationApi {
  return useContext(CelebrationContext);
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [confettiKeys, setConfettiKeys] = useState<number[]>([]);
  const [miniKeys, setMiniKeys] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string>('Captured!');
  const [miniToastMessage, setMiniToastMessage] = useState<string>('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const miniToastAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);
  const insets = useSafeAreaInsets();
  const lastBaseShownAtRef = useRef<number>(0);
  const lastBasePlannedAtRef = useRef<number>(0);

  const celebrate = useCallback((options?: CelebrateOptions) => {
    const delay = Math.max(0, options?.delayMs ?? 280);
    const message = options?.message ?? 'Captured!';
    lastBasePlannedAtRef.current = Date.now() + delay;
    setTimeout(() => {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 120);
      } catch {}

      setToastMessage(message);
      toastAnim.stopAnimation();
      toastAnim.setValue(0);
      lastBaseShownAtRef.current = Date.now();
      Animated.sequence([
        Animated.timing(toastAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.delay(1700),
        Animated.timing(toastAnim, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]).start();
      setConfettiKeys((k) => [...k, Date.now()]);
    }, delay);
  }, [toastAnim]);

  const celebrateBonus = useCallback((options: BonusCelebrateOptions) => {
    const requestedDelay = Math.max(0, options?.delayMs ?? 0);
    const MIN_GAP_MS = 1600; // ensure base toast/confetti has time before showing bonus
    const now = Date.now();
    const baseAnchor = Math.max(lastBaseShownAtRef.current || 0, lastBasePlannedAtRef.current || 0);
    const needed = Math.max(0, (baseAnchor + MIN_GAP_MS) - now);
    const delay = requestedDelay + needed;
    const message = options.message;
    setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      setMiniToastMessage(message);
      miniToastAnim.stopAnimation();
      miniToastAnim.setValue(0);
      Animated.sequence([
        Animated.timing(miniToastAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.delay(1400),
        Animated.timing(miniToastAnim, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]).start();
      setMiniKeys((k) => [...k, Date.now()]);
    }, delay);
  }, [miniToastAnim]);

  function removeConfetti(key: number) {
    setConfettiKeys((prev) => prev.filter((k) => k !== key));
  }
  function removeMini(key: number) {
    setMiniKeys((prev) => prev.filter((k) => k !== key));
  }

  return (
    <CelebrationContext.Provider value={{ celebrate, celebrateBonus }}>
      <View style={{ flex: 1 }}>
        {children}
        {/* Base capture overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: insets.top + 12,
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] })
                },
              ],
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
        {confettiKeys.map((k) => (
          <ConfettiBurst key={k} width={screenWidth} onDone={() => removeConfetti(k)} topOffset={insets.top} />
        ))}

        {/* Bonus centered overlay with sparkler + shimmer */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.miniToast,
            {
              top: insets.top + 120,
              opacity: miniToastAnim,
              transform: [
                {
                  translateY: miniToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] })
                },
              ],
            },
          ]}
        >
          <Sparkler intensity={18} durationMs={1200} />
          <Shimmer />
          <Text style={styles.miniToastText}>{miniToastMessage}</Text>
        </Animated.View>
        {miniKeys.map((k) => (
          <MiniConfetti key={k} onDone={() => removeMini(k)} topOffset={insets.top + 24} />
        ))}
      </View>
    </CelebrationContext.Provider>
  );
}

function ConfettiBurst({ width, onDone, topOffset = 0 }: { width: number; onDone: () => void; topOffset?: number }) {
  const pieces = 24;
  const colors = ['#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#8338EC'];
  const animations = useRef(
    Array.from({ length: pieces }, () => ({
      x: new Animated.Value(width / 2),
      y: new Animated.Value(0),
      r: new Animated.Value(0),
      o: new Animated.Value(1),
    }))
  ).current;

  React.useEffect(() => {
    const anims = animations.map(({ x, y, r, o }) => {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const spread = 130 + Math.random() * 70; // degrees
      const angle = ((-90 + dir * spread) * Math.PI) / 180;
      const distance = 160 + Math.random() * 160;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const duration = 1400 + Math.random() * 900;
      return Animated.parallel([
        Animated.timing(x, { toValue: width / 2 + dx, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(y, { toValue: 80 + dy, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(r, { toValue: 360 * (Math.random() > 0.5 ? 1 : -1), duration, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(o, { toValue: 0, duration: duration + 300, easing: Easing.linear, useNativeDriver: false }),
      ]);
    });
    Animated.stagger(10, anims).start(() => onDone());
  }, [animations, onDone, width]);

  return (
    <View pointerEvents="none" style={[styles.confettiContainer, { top: topOffset }]}>
      {animations.map(({ x, y, r, o }, i) => {
        const size = 6 + Math.random() * 8;
        const bg = colors[i % colors.length];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              backgroundColor: bg,
              borderRadius: 2,
              opacity: o,
              transform: [
                { rotate: r.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                { translateX: new Animated.Value(0) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

function Sparkler({ intensity = 16, durationMs = 1000 }: { intensity?: number; durationMs?: number }) {
  const sparks = useRef(
    Array.from({ length: intensity }, () => ({
      r: new Animated.Value(0), // radial distance
      o: new Animated.Value(0.9), // opacity
      s: new Animated.Value(0.6), // scale
      a: Math.random() * Math.PI * 2, // angle
      c: ['#FFE08A', '#FFF3B0', '#FFD166'][Math.floor(Math.random() * 3)],
    }))
  ).current;

  React.useEffect(() => {
    const anims = sparks.map(({ r, o, s }) => {
      const travel = 18 + Math.random() * 22;
      const d = durationMs - Math.random() * 300;
      return Animated.parallel([
        Animated.timing(r, { toValue: travel, duration: d, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.sequence([
          Animated.timing(o, { toValue: 1, duration: 120, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(o, { toValue: 0, duration: d - 120, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(s, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(s, { toValue: 0.7, duration: d - 180, easing: Easing.linear, useNativeDriver: false }),
        ]),
      ]);
    });
    Animated.stagger(12, anims).start();
  }, [sparks, durationMs]);

  return (
    <View pointerEvents="none" style={styles.sparklerLayer}>
      {/* center glow */}
      <View style={styles.sparklerGlow} />
      {sparks.map((sp, i) => {
        const x = sp.r.interpolate({ inputRange: [0, 50], outputRange: [0, Math.cos((sp as any).a) * 50] });
        const y = sp.r.interpolate({ inputRange: [0, 50], outputRange: [0, Math.sin((sp as any).a) * 50] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: (sp as any).c,
              opacity: sp.o,
              transform: [{ scale: sp.s }],
            }}
          />
        );
      })}
    </View>
  );
}

function Shimmer() {
  const x = useRef(new Animated.Value(-120)).current;
  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(x, { toValue: 220, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(x, { toValue: 220, duration: 200, easing: Easing.linear, useNativeDriver: false }),
    ]).start();
  }, [x]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -6,
        left: x,
        width: 80,
        height: 56,
        backgroundColor: 'rgba(255,255,255,0.22)',
        transform: [{ rotate: '18deg' }],
        borderRadius: 12,
      }}
    />
  );
}

function MiniConfetti({ onDone, topOffset = 0 }: { onDone: () => void; topOffset?: number }) {
  const pieces = 12;
  const colors = ['#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#8338EC'];
  const animations = useRef(
    Array.from({ length: pieces }, () => ({
      y: new Animated.Value(0),
      o: new Animated.Value(1),
    }))
  ).current;

  React.useEffect(() => {
    const anims = animations.map(({ y, o }) => {
      const dy = 50 + Math.random() * 50;
      const duration = 700 + Math.random() * 300;
      return Animated.parallel([
        Animated.timing(y, { toValue: dy, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(o, { toValue: 0, duration: duration + 150, easing: Easing.linear, useNativeDriver: false }),
      ]);
    });
    Animated.stagger(20, anims).start(() => onDone());
  }, [animations, onDone]);

  return (
    <View pointerEvents="none" style={[styles.miniConfettiContainer, { top: topOffset }]}> 
      {animations.map(({ y, o }, i) => {
        const size = 4 + Math.random() * 6;
        const bg = colors[i % colors.length];
        const left = 30 + Math.random() * 60; // small sprinkle near top center
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left,
              top: y,
              width: size,
              height: size,
              backgroundColor: bg,
              borderRadius: 2,
              opacity: o,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  toastText: { color: '#fff', fontWeight: '700' },
  miniToast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.96)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  miniToastText: { color: '#fff', fontWeight: '900', fontSize: 18, textAlign: 'center' },
  sparklerLayer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 1,
    height: 1,
    marginLeft: 0,
    marginTop: 0,
  },
  sparklerGlow: {
    position: 'absolute',
    left: -18,
    top: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 224, 138, 0.35)',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  miniConfettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
});


