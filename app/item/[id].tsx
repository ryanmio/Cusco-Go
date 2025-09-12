import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, ActionSheetIOS, Alert, Animated, Easing, Dimensions, InteractionManager } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { HUNT_ITEMS } from '@/data/items';
import { getLatestCaptureForItem, deleteCapture } from '@/lib/db';
import { ensureAppDirs } from '@/lib/files';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { getSingleLocationOrNull, extractGpsFromExif, ensureWhenInUsePermission } from '@/lib/location';
import { removeFileIfExists } from '@/lib/files';

export default function ItemDetailScreen() {
  const { id, celebrate } = useLocalSearchParams<{ id: string; celebrate?: string }>();
  const item = HUNT_ITEMS.find(i => i.id === id);
  const latestCapture = id ? getLatestCaptureForItem(id) : null;
  const [confettiKeys, setConfettiKeys] = useState<number[]>([]);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Item not found</Text>
      </View>
    );
  }

  const didCelebrate = useRef(false);

  const triggerCelebration = useCallback(() => {
    // Haptics (celebratory)
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 120);
    } catch {}

    // Toast
    toastAnim.stopAnimation();
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.delay(1500),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]).start();

    // Confetti
    setConfettiKeys((k) => [...k, Date.now()]);
  }, [toastAnim]);

  useFocusEffect(
    useCallback(() => {
      if (celebrate && !didCelebrate.current) {
        didCelebrate.current = true;
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            triggerCelebration();
            // Clean URL param to avoid retrigger on back/forward
            if (id) {
              setTimeout(() => router.replace(`/item/${id}`), 1600);
            }
          }, 60);
        });
      }
    }, [celebrate, id, triggerCelebration])
  );

  function removeConfetti(key: number) {
    setConfettiKeys((prev) => prev.filter((k) => k !== key));
  }

  async function onMenuPress() {
    if (!latestCapture) return;
    
    // Pre-warm permission only
    await ensureWhenInUsePermission();

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Delete Capture', 'Replace Photo', 'Save to Photos'],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 1,
      },
      async (index) => {
        if (index === 1) {
          // Delete
          Alert.alert('Delete Capture?', 'This will permanently delete this photo and all its data.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', 
              style: 'destructive', 
              onPress: async () => {
                if (latestCapture) {
                  await removeFileIfExists(latestCapture.originalUri);
                  await removeFileIfExists(latestCapture.thumbnailUri);
                  deleteCapture(latestCapture.id);
                  router.back();
                }
              }
            }
          ]);
        } else if (index === 2) {
          // Replace
          await replacePhoto();
        } else if (index === 3) {
          // Save to Photos
          await saveToPhotos();
        }
      }
    );
  }

  async function replacePhoto() {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      async (index) => {
        try {
          let result;
          if (index === 1) {
            result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1, exif: true });
          } else if (index === 2) {
            result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 1, exif: true });
          }
          
          if (result && !result.canceled && latestCapture) {
            // Delete old files
            await removeFileIfExists(latestCapture.originalUri);
            await removeFileIfExists(latestCapture.thumbnailUri);
            
            // Create new capture
            const exifGps = extractGpsFromExif(result.assets[0].exif ?? null);
            const loc = exifGps ?? (await getSingleLocationOrNull());
            const stamp = Date.now();
            const saved = await saveOriginalAndSquareThumbnail(result.assets[0].uri, `${item.id}_${stamp}`);
            
            // Update database
            deleteCapture(latestCapture.id);
            const { insertCapture } = await import('@/lib/db');
            insertCapture({
              itemId: item.id,
              title: item.title,
              originalUri: saved.originalUri,
              thumbnailUri: saved.thumbnailUri,
              createdAt: stamp,
              latitude: loc?.latitude ?? null,
              longitude: loc?.longitude ?? null,
            });
            
            router.replace(`/item/${item.id}`);
          }
        } catch (e: any) {
          Alert.alert('Replace failed', String(e?.message ?? e));
        }
      }
    );
  }

  async function saveToPhotos() {
    if (!latestCapture) return;
    await MediaLibrary.requestPermissionsAsync();
    await MediaLibrary.saveToLibraryAsync(latestCapture.originalUri);
    Alert.alert('Saved!', 'Photo saved to your Photos library.');
  }

  function onViewPhoto() {
    if (latestCapture) {
      router.push(`/viewer?uri=${encodeURIComponent(latestCapture.originalUri)}`);
    }
  }

  function onCapture() {
    router.push(`/(tabs)/?capture=${id}`);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Image 
          source={latestCapture ? { uri: latestCapture.thumbnailUri } : item.placeholder} 
          style={styles.image} 
          resizeMode="cover" 
        />
        {latestCapture && (
          <>
            <Pressable style={styles.viewButton} onPress={onViewPhoto}>
              <Text style={styles.viewButtonText}>View Full Size</Text>
            </Pressable>
            <Pressable style={styles.menuButton} onPress={onMenuPress}>
              <Text style={styles.menuButtonText}>⋯</Text>
            </Pressable>
          </>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.categoryContainer}>
          <Text style={styles.category}>{item.category.toUpperCase()}</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
        
        {!latestCapture && (
          <Pressable style={styles.captureButton} onPress={onCapture}>
            <Text style={styles.captureButtonText}>Capture Photo</Text>
          </Pressable>
        )}
      </View>
      </ScrollView>
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
      {/* Confetti */}
      {confettiKeys.map((k) => (
        <ConfettiBurst key={k} width={screenWidth} onDone={() => removeConfetti(k)} />
      ))}
    </View>
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

  useEffect(() => {
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
  container: { flex: 1, backgroundColor: 'white' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageContainer: { position: 'relative', aspectRatio: 1, backgroundColor: '#f0f0f0' },
  image: { width: '100%', height: '100%' },
  viewButton: { 
    position: 'absolute', 
    bottom: 16, 
    right: 16, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  viewButtonText: { color: 'white', fontWeight: '600' },
  menuButton: { 
    position: 'absolute', 
    top: 16, 
    right: 16, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  menuButtonText: { color: 'white', fontWeight: '600', fontSize: 18 },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  categoryContainer: { marginBottom: 16 },
  category: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#666', 
    letterSpacing: 1,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  description: { fontSize: 16, lineHeight: 24, color: '#333' },
  captureButton: { 
    marginTop: 24, 
    backgroundColor: '#007AFF', 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  captureButtonText: { color: 'white', fontSize: 18, fontWeight: '600' },
});
