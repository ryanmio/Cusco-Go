import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Image, StyleSheet, Text, TextInput, View, ActivityIndicator, Animated, Easing, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { HUNT_ITEMS } from '@/data/items';
import { ensureAppDirs } from '@/lib/files';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { getLatestCaptureForItem, insertCapture, updateCaptureLocation } from '@/lib/db';
import { getSingleLocationOrNull, extractGpsFromExif, ensureWhenInUsePermission } from '@/lib/location';
import { CaptureCard } from '@/components/CaptureCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as Haptics from 'expo-haptics';

export default function HuntGridScreen() {
  const [version, setVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [optimisticThumbUri, setOptimisticThumbUri] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const [confettiKeys, setConfettiKeys] = useState<number[]>([]);
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);

  useEffect(() => {
    ensureAppDirs();
  }, []);

  const filteredItems = HUNT_ITEMS.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function onPick(itemId: string, title: string) {
    // Ensure permissions for camera and media library before presenting options
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Pre-warm permission only (starting a fix before opening camera can be suspended)
    await ensureWhenInUsePermission();

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      async (index) => {
        try {
          if (index === 1) {
            const cam = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1, exif: true });
            if (!cam.canceled) await handlePicked(cam.assets[0].uri, itemId, title, cam.assets[0].exif ?? null);
          } else if (index === 2) {
            const lib = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 1, exif: true });
            if (!lib.canceled) await handlePicked(lib.assets[0].uri, itemId, title, lib.assets[0].exif ?? null);
          }
        } catch (e: any) {
          Alert.alert('Capture failed', String(e?.message ?? e));
        }
      }
    );
  }

  async function handlePicked(uri: string, itemId: string, title: string, pickedExif?: any | null) {
    setProcessingItemId(itemId);
    setOptimisticThumbUri(null);
    const stamp = Date.now();
    // Start EXIF parse immediately
    const exifGps = extractGpsFromExif(pickedExif);
    // Save files first for snappier UI, then fetch GPS if needed
    const saved = await saveOriginalAndSquareThumbnail(uri, `${itemId}_${stamp}`);
    setOptimisticThumbUri(saved.thumbnailUri);
    // Insert row with whatever location we have synchronously (EXIF or null)
    const id = insertCapture({
      itemId,
      title,
      originalUri: saved.originalUri,
      thumbnailUri: saved.thumbnailUri,
      createdAt: stamp,
      latitude: exifGps?.latitude ?? null,
      longitude: exifGps?.longitude ?? null,
    });
    setVersion(v => v + 1);
    // Celebration feedback
    triggerCelebration();
    // Navigate to the item's page so the user can see details immediately
    setTimeout(() => {
      router.push(`/item/${itemId}`);
    }, 200);
    // If no EXIF GPS, resolve a fresh fix in the background and update row
    if (!exifGps) {
      getSingleLocationOrNull().then((loc) => {
        if (loc) {
          updateCaptureLocation(id, loc.latitude, loc.longitude);
        }
      }).finally(() => {
        setProcessingItemId(null);
      });
    } else {
      setProcessingItemId(null);
    }
  }

  function onCardPress(item: any) {
    const latest = getLatestCaptureForItem(item.id);
    if (latest) {
      // Navigate to item detail page if photo exists
      router.push(`/item/${item.id}`);
    } else {
      // Show capture options if no photo
      onPick(item.id, item.title);
    }
  }

  function renderCard({ item }: any) {
    const isProcessing = processingItemId === item.id;
    const latest = getLatestCaptureForItem(item.id);
    const thumbSource = isProcessing && optimisticThumbUri
      ? { uri: optimisticThumbUri }
      : latest
      ? { uri: latest.thumbnailUri }
      : item.placeholder;
    return (
      <View style={{ flex: 1 }}>
        <CaptureCard 
          id={item.id} 
          title={item.title} 
          placeholder={thumbSource} 
          onPress={() => onCardPress(item)} 
        />
        {isProcessing && (
          <View style={styles.processingOverlay} pointerEvents="none">
            <View style={styles.processingBadge}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.processingText}>Saving…</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  function triggerCelebration() {
    // Toast
    setShowToast(true);
    toastAnim.stopAnimation();
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]).start(() => setShowToast(false));

    // Confetti
    setConfettiKeys((prev) => [...prev, Date.now()]);

    // Haptics: light selection + success impact a short moment later
    try {
      Haptics.selectionAsync();
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 150);
    } catch {}
  }

  function removeConfetti(key: number) {
    setConfettiKeys((prev) => prev.filter((k) => k !== key));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.searchBackground,
              color: colors.searchText,
              borderColor: colors.border,
            }
          ]}
          placeholder="Search items..."
          placeholderTextColor={colors.searchPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={filteredItems}
        keyExtractor={(i) => i.id + ':' + version}
        numColumns={2}
        renderItem={renderCard}
      />
      {/* Toast */}
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
        <Text style={styles.toastText}>Captured!</Text>
      </Animated.View>
      {/* Confetti bursts */}
      {confettiKeys.map((k) => (
        <ConfettiBurst key={k} width={screenWidth} onDone={() => removeConfetti(k)} />
      ))}
    </View>
  );
}

function ConfettiBurst({ width, onDone }: { width: number; onDone: () => void }) {
  const pieces = 18;
  const colors = ['#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#8338EC'];
  const animations = useRef(
    Array.from({ length: pieces }, () => ({
      x: new Animated.Value(width / 2),
      y: new Animated.Value(0),
      r: new Animated.Value(0),
      o: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    const anims = animations.map(({ x, y, r, o }, idx) => {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const spread = 120 + Math.random() * 60; // degrees
      const angle = ((-90 + dir * spread) * Math.PI) / 180;
      const distance = 140 + Math.random() * 120;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance; // negative up
      const duration = 900 + Math.random() * 600;
      return Animated.parallel([
        Animated.timing(x, { toValue: width / 2 + dx, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(y, { toValue: 60 + dy, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(r, { toValue: 360 * (Math.random() > 0.5 ? 1 : -1), duration, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(o, { toValue: 0, duration: duration + 200, easing: Easing.linear, useNativeDriver: false }),
      ]);
    });
    Animated.stagger(12, anims).start(() => onDone());
  }, [animations, onDone, width]);

  return (
    <View pointerEvents="none" style={styles.confettiContainer}>
      {animations.map(({ x, y, r, o }, i) => {
        const size = 6 + Math.random() * 6;
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
                {
                  rotate: r.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }),
                },
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
  container: { flex: 1 },
  searchContainer: { padding: 16, paddingBottom: 8 },
  searchInput: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 12, 
    fontSize: 16,
    borderWidth: 1,
  },
  list: { padding: 8 },
  processingOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  processingText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
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
    height: 160,
  },
});
