import { useEffect, useState, useRef, useMemo } from 'react';
import { ActionSheetIOS, Alert, FlatList, StyleSheet, Text, TextInput, View, ActivityIndicator, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassSurface from '@/components/GlassSurface';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCelebration } from '@/components/CelebrationProvider';
import { HUNT_ITEMS } from '@/data/items';
import { ensureAppDirs } from '@/lib/files';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { addCapturesListener, listCaptures, insertCapture, updateCaptureLocation } from '@/lib/db';
import { getSingleLocationOrNull, getSingleLocationIfPermitted, extractGpsFromExif, ensureWhenInUsePermission } from '@/lib/location';
import { evaluateAndRecordBiomeBonus } from '@/lib/biomeScoring';
import * as MediaLibrary from 'expo-media-library';

// Extract photo taken date from EXIF data
function extractPhotoDateFromExif(exif: any | null): number | null {
  if (!exif) return null;

  // Try different EXIF date fields in order of preference
  const dateFields = ['DateTimeOriginal', 'DateTime', 'DateTimeDigitized'];
  let dateStr: string | undefined;
  for (const field of dateFields) {
    const candidate = exif[field];
    if (typeof candidate === 'string' && candidate.length >= 19) {
      dateStr = candidate;
      break;
    }
  }

  // Include timezone offset if provided (e.g., "-04:00") and subseconds
  const offset: string | undefined = exif.OffsetTimeOriginal || exif.OffsetTimeDigitized || exif.OffsetTime;
  const subsec: string | undefined = exif.SubsecTimeOriginal || exif.SubsecTimeDigitized || exif.SubSecTime;

  if (dateStr) {
    // EXIF dates are typically "YYYY:MM:DD HH:MM:SS"
    // Convert only the date part's colons, leave time colons intact
    const base = dateStr
      .replace(' ', 'T')
      .replace(/^([0-9]{4}):([0-9]{2}):([0-9]{2})/, '$1-$2-$3');
    const frac = subsec ? `.${String(subsec).padStart(3, '0').slice(0, 3)}` : '';
    const tz = typeof offset === 'string' && /^([+\-]\d{2}:\d{2})$/.test(offset) ? offset : 'Z';
    const iso = `${base}${frac}${tz}`;
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  // GPS fallback (UTC per EXIF spec)
  const gpsDate: string | undefined = exif.GPSDateStamp;
  const gpsTime: string | undefined = exif.GPSTimeStamp;
  if (gpsDate && gpsTime) {
    const base = `${gpsDate.replace(/:/g, '-')}`;
    const iso = `${base}T${gpsTime}Z`;
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}
import { CaptureCard } from '@/components/CaptureCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HuntGridScreen() {
  const insets = useSafeAreaInsets();
  const { celebrate, celebrateBonus } = useCelebration();
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

  // Build a latest-capture map once per version change to avoid per-card DB reads
  const latestByItemId = useMemo(() => {
    const rows = listCaptures(); // ORDER BY createdAt DESC
    const map = new Map<string, { thumbnailUri: string; id: number }>();
    for (const r of rows) {
      if (!map.has(r.itemId)) {
        map.set(r.itemId, { thumbnailUri: r.thumbnailUri, id: r.id });
      }
    }
    return map;
  }, [version]);

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
            if (!cam.canceled) await handlePicked(cam.assets[0].uri, itemId, title, cam.assets[0].exif ?? null, true);
          } else if (index === 2) {
            await ImagePicker.requestMediaLibraryPermissionsAsync();
            const lib = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 1, exif: true });
            if (!lib.canceled) await handlePicked(lib.assets[0].uri, itemId, title, lib.assets[0].exif ?? null, false);
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

  async function silentlySaveToPhotosIfPermitted(localUri: string) {
    try {
      const perm = await MediaLibrary.getPermissionsAsync();
      if (!perm.granted) return; // Stay silent; do not prompt
      const asset = await MediaLibrary.createAssetAsync(localUri);
      try {
        const albumName = 'Cusco Go';
        let album = await MediaLibrary.getAlbumAsync(albumName);
        if (!album) {
          album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch {}
    } catch {}
  }

  async function ensurePhotosPermissionRequestedOnce() {
    try {
      const perm = await MediaLibrary.getPermissionsAsync();
      if (perm.granted) return;
      if (perm.canAskAgain) {
        await MediaLibrary.requestPermissionsAsync();
      }
    } catch {}
  }

  async function handlePicked(uri: string, itemId: string, title: string, pickedExif?: any | null, isFromCamera: boolean = false) {
    setProcessingItemId(itemId);
    setOptimisticThumbUri(null);
    const stamp = Date.now();
    // Start EXIF parse immediately
    const exifGps = extractGpsFromExif(pickedExif);
    const photoTakenAt = extractPhotoDateFromExif(pickedExif) || stamp; // Use EXIF date or fallback to current time
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
      photoTakenAt: photoTakenAt,
      latitude: exifGps?.latitude ?? null,
      longitude: exifGps?.longitude ?? null,
    });
    setVersion(v => v + 1);
    // Trigger base celebration immediately so confetti is visible before navigating
    celebrate({ delayMs: 0, message: 'Captured!' });
    // Fire biome bonus in background (based on EXIF GPS if present)
    const item = HUNT_ITEMS.find(i => i.id === itemId);
    const basePoints = item?.difficulty ?? 0;
    if (basePoints > 0) {
      setTimeout(async () => {
        const res = await evaluateAndRecordBiomeBonus({
          captureId: id,
          latitude: exifGps?.latitude ?? null,
          longitude: exifGps?.longitude ?? null,
          basePoints,
        });
        if (res.awarded && res.bonusPoints > 0 && res.biomeLabel && res.multiplier) {
          celebrateBonus({
            delayMs: 0,
            message: `${res.biomeLabel} ×${res.multiplier.toFixed(1)} → +${res.bonusPoints} pts`,
          });
        }
      }, 100);
    }
    // Navigate to the item's page after a short delay to let confetti begin
    setTimeout(() => {
      router.push(`/item/${itemId}`);
    }, 150);

    // Silent background save to Photos for camera captures only
    if (isFromCamera) {
      await ensurePhotosPermissionRequestedOnce();
      silentlySaveToPhotosIfPermitted(saved.originalUri);
    }
    // If no EXIF GPS, resolve a fresh fix in the background and update row, then try bonus
    if (!exifGps) {
      // Silent: only attempt if already permitted; do not prompt
      getSingleLocationIfPermitted().then(async (loc) => {
        if (loc) {
          updateCaptureLocation(id, loc.latitude, loc.longitude);
          if (basePoints > 0) {
            const res = await evaluateAndRecordBiomeBonus({
              captureId: id,
              latitude: loc.latitude,
              longitude: loc.longitude,
              basePoints,
            });
            if (res.awarded && res.bonusPoints > 0 && res.biomeLabel && res.multiplier) {
              celebrateBonus({
                delayMs: 0,
                message: `${res.biomeLabel} ×${res.multiplier.toFixed(1)} → +${res.bonusPoints} pts`,
              });
            }
          }
        }
      }).finally(() => {
        setProcessingItemId(null);
      });
    } else {
      setProcessingItemId(null);
    }
  }

  function onCardPress(item: any) {
    const latest = latestByItemId.get(item.id);
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
    const latest = latestByItemId.get(item.id);
    const resolvedThumbUri = isProcessing && optimisticThumbUri
      ? optimisticThumbUri
      : latest?.thumbnailUri ?? null;
    return (
      <View style={{ flex: 1 }}>
        <CaptureCard 
          id={item.id} 
          title={item.title} 
          placeholder={item.placeholder}
          thumbnailUri={resolvedThumbUri}
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
        ListFooterComponent={<View style={{ height: Math.max(48, insets.bottom + 48) }} />}
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
