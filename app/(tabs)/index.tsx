import { useEffect, useState, useRef } from 'react';
import { ActionSheetIOS, Alert, FlatList, Image, StyleSheet, Text, TextInput, View, ActivityIndicator, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent, Animated } from 'react-native';
import GlassSurface from '@/components/GlassSurface';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCelebration } from '@/components/CelebrationProvider';
import { HUNT_ITEMS } from '@/data/items';
import { ensureAppDirs } from '@/lib/files';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { addCapturesListener, getLatestCaptureForItem, insertCapture, updateCaptureLocation } from '@/lib/db';
import { getSingleLocationOrNull, extractGpsFromExif, ensureWhenInUsePermission } from '@/lib/location';
import { CaptureCard } from '@/components/CaptureCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HuntGridScreen() {
  const { celebrate } = useCelebration();
  const [version, setVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'animal' | 'plant' | 'ruins'>('all');
  // Overlay header that mirrors the list header for mid-list reveal
  const [showOverlay, setShowOverlay] = useState(false);
  const lastYRef = useRef(0);
  const lastToggleAtMsRef = useRef(0);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayTranslate = useRef(new Animated.Value(-6)).current;
  const dirRef = useRef<1 | -1 | 0>(0);
  const accumRef = useRef(0);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [optimisticThumbUri, setOptimisticThumbUri] = useState<string | null>(null);

  useEffect(() => {
    ensureAppDirs();
  }, []);

  // Re-render when captures change (insert/delete/update) so cards reflect latest state
  useEffect(() => {
    const unsubscribe = addCapturesListener(() => {
      setVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const isSearching = searchQuery.trim().length > 0;
  const filteredItems = HUNT_ITEMS.filter((item) => {
    if (isSearching) {
      return item.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    const activeCategory = categoryFilter === 'ruins' ? 'place' : categoryFilter;
    const matchesCategory = categoryFilter === 'all' ? true : item.category === activeCategory;
    return matchesCategory;
  });

  function onListScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastYRef.current;
    lastYRef.current = y;
    if (Math.abs(dy) < 2) return;
    // If at the very top (header fully visible), snap-hide overlay immediately
    if (y <= 0) {
      if (showOverlay) {
        overlayOpacity.setValue(0);
        overlayTranslate.setValue(-6);
        setShowOverlay(false);
      }
      return;
    }
    const { contentSize, layoutMeasurement } = e.nativeEvent;
    const atBottom = y + layoutMeasurement.height >= contentSize.height - 2;
    if (atBottom && dy < 0) return; // ignore bounce at bottom
    const now = Date.now();
    const dir: 1 | -1 = dy > 0 ? 1 : -1;
    if (dirRef.current !== dir) {
      dirRef.current = dir;
      accumRef.current = 0;
    }
    accumRef.current += Math.abs(dy);
    const HIDE_THRESHOLD = 80;
    const SHOW_THRESHOLD = 80;
    const COOLDOWN_MS = 180;
    if (now - lastToggleAtMsRef.current < COOLDOWN_MS) return;
    if (dir === -1 && !showOverlay && accumRef.current > SHOW_THRESHOLD) {
      setShowOverlay(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayTranslate, { toValue: 0, duration: 220, useNativeDriver: true })
      ]).start();
      lastToggleAtMsRef.current = now;
      accumRef.current = 0;
    } else if (dir === 1 && showOverlay && accumRef.current > HIDE_THRESHOLD) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayTranslate, { toValue: -6, duration: 220, useNativeDriver: true })
      ]).start(({ finished }) => {
        if (finished) setShowOverlay(false);
      });
      lastToggleAtMsRef.current = now;
      accumRef.current = 0;
    }
  }

  async function onPick(itemId: string, title: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library', 'Details'],
        cancelButtonIndex: 0,
      },
      async (index) => {
        try {
          if (index === 1) {
            // Request permissions lazily when needed
            await ImagePicker.requestCameraPermissionsAsync();
            // Pre-warm location permission only when capturing
            await ensureWhenInUsePermission();
            const cam = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1, exif: true });
            if (!cam.canceled) await handlePicked(cam.assets[0].uri, itemId, title, cam.assets[0].exif ?? null);
          } else if (index === 2) {
            await ImagePicker.requestMediaLibraryPermissionsAsync();
            const lib = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 1, exif: true });
            if (!lib.canceled) await handlePicked(lib.assets[0].uri, itemId, title, lib.assets[0].exif ?? null);
          } else if (index === 3) {
            // Navigate to item details page
            router.push(`/item/${itemId}`);
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
    // Trigger global celebration slightly delayed to allow nav to settle
    celebrate({ delayMs: 260, message: 'Captured!' });
    // Navigate to the item's page
    router.push(`/item/${itemId}`);
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


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showOverlay && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.background, zIndex: 10, opacity: overlayOpacity, transform: [{ translateY: overlayTranslate }] }}>
          <View style={styles.searchContainer}>
            <GlassSurface style={styles.glassField} glassEffectStyle="regular" isInteractive>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: 'transparent',
                    color: colors.searchText,
                    borderColor: 'transparent',
                  }
                ]}
                placeholder="Search items..."
                placeholderTextColor={colors.searchPlaceholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </GlassSurface>
          </View>
          {!isSearching && (
            <View style={[styles.filterContainer]}>
              <TouchableOpacity
                onPress={() => setCategoryFilter('all')}
                style={{ borderRadius: 16 }}
              >
                <GlassSurface style={styles.glassChip} glassEffectStyle="clear" isInteractive tintColor={categoryFilter === 'all' ? colors.tint : undefined}>
                  <Text style={{ fontWeight: '600', color: colors.searchText }}>All</Text>
                </GlassSurface>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCategoryFilter('animal')}
                style={{ borderRadius: 16 }}
              >
                <GlassSurface style={styles.glassChip} glassEffectStyle="clear" isInteractive tintColor={categoryFilter === 'animal' ? colors.tint : undefined}>
                  <Text style={{ fontWeight: '600', color: colors.searchText }}>Animals</Text>
                </GlassSurface>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCategoryFilter('plant')}
                style={{ borderRadius: 16 }}
              >
                <GlassSurface style={styles.glassChip} glassEffectStyle="clear" isInteractive tintColor={categoryFilter === 'plant' ? colors.tint : undefined}>
                  <Text style={{ fontWeight: '600', color: colors.searchText }}>Plants</Text>
                </GlassSurface>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCategoryFilter('ruins')}
                style={{ borderRadius: 16 }}
              >
                <GlassSurface style={styles.glassChip} glassEffectStyle="clear" isInteractive tintColor={categoryFilter === 'ruins' ? colors.tint : undefined}>
                  <Text style={{ fontWeight: '600', color: colors.searchText }}>Ruins</Text>
                </GlassSurface>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}
      <FlatList
        onScroll={onListScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            <View style={styles.searchContainer}>
              <GlassSurface style={styles.glassField} glassEffectStyle="regular" isInteractive>
                <TextInput
                  style={[
                    styles.searchInput,
                    {
                      backgroundColor: 'transparent',
                      color: colors.searchText,
                      borderColor: 'transparent',
                    }
                  ]}
                  placeholder="Search items..."
                  placeholderTextColor={colors.searchPlaceholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </GlassSurface>
            </View>
            {!isSearching && (
              <View style={[styles.filterContainer]}
              >
                <TouchableOpacity
                  onPress={() => setCategoryFilter('all')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: categoryFilter === 'all' ? colors.tint : colors.border,
                    backgroundColor: categoryFilter === 'all' ? colors.tint : colors.searchBackground,
                  }}
                >
                  <Text style={{
                    fontWeight: '600',
                    color: categoryFilter === 'all' ? '#fff' : colors.searchText,
                  }}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCategoryFilter('animal')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: categoryFilter === 'animal' ? colors.tint : colors.border,
                    backgroundColor: categoryFilter === 'animal' ? colors.tint : colors.searchBackground,
                  }}
                >
                  <Text style={{
                    fontWeight: '600',
                    color: categoryFilter === 'animal' ? '#fff' : colors.searchText,
                  }}>Animals</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCategoryFilter('plant')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: categoryFilter === 'plant' ? colors.tint : colors.border,
                    backgroundColor: categoryFilter === 'plant' ? colors.tint : colors.searchBackground,
                  }}
                >
                  <Text style={{
                    fontWeight: '600',
                    color: categoryFilter === 'plant' ? '#fff' : colors.searchText,
                  }}>Plants</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCategoryFilter('ruins')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: categoryFilter === 'ruins' ? colors.tint : colors.border,
                    backgroundColor: categoryFilter === 'ruins' ? colors.tint : colors.searchBackground,
                  }}
                >
                  <Text style={{
                    fontWeight: '600',
                    color: categoryFilter === 'ruins' ? '#fff' : colors.searchText,
                  }}>Ruins</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.list}
        data={filteredItems}
        keyExtractor={(i) => i.id + ':' + version}
        numColumns={2}
        renderItem={renderCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  searchInput: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 12, 
    fontSize: 16,
    borderWidth: 1,
  },
  glassField: { borderRadius: 12, overflow: 'hidden' },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  glassChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
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
});
