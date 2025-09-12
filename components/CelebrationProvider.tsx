import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

type CelebrateOptions = {
  delayMs?: number;
  message?: string;
};

type CelebrationApi = {
  celebrate: (options?: CelebrateOptions) => void;
};

const CelebrationContext = createContext<CelebrationApi>({ celebrate: () => {} });

export function useCelebration(): CelebrationApi {
  return useContext(CelebrationContext);
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [confettiKeys, setConfettiKeys] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string>('Captured!');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);

  const celebrate = useCallback((options?: CelebrateOptions) => {
    const delay = Math.max(0, options?.delayMs ?? 280);
    const message = options?.message ?? 'Captured!';
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
      Animated.sequence([
        Animated.timing(toastAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.delay(1500),
        Animated.timing(toastAnim, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]).start();
      setConfettiKeys((k) => [...k, Date.now()]);
    }, delay);
  }, [toastAnim]);

  function removeConfetti(key: number) {
    setConfettiKeys((prev) => prev.filter((k) => k !== key));
  }

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      <View style={{ flex: 1 }}>
        {children}
        {/* Global overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
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
          <ConfettiBurst key={k} width={screenWidth} onDone={() => removeConfetti(k)} />
        ))}
      </View>
    </CelebrationContext.Provider>
  );
}

function ConfettiBurst({ width, onDone }: { width: number; onDone: () => void }) {
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
      const distance = 160 + Math.random() * 140;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const duration = 1100 + Math.random() * 700;
      return Animated.parallel([
        Animated.timing(x, { toValue: width / 2 + dx, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(y, { toValue: 80 + dy, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(r, { toValue: 360 * (Math.random() > 0.5 ? 1 : -1), duration, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(o, { toValue: 0, duration: duration + 250, easing: Easing.linear, useNativeDriver: false }),
      ]);
    });
    Animated.stagger(10, anims).start(() => onDone());
  }, [animations, onDone, width]);

  return (
    <View pointerEvents="none" style={styles.confettiContainer}>
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

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  toastText: { color: '#fff', fontWeight: '700' },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
});


