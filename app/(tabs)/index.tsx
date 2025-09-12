import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Image, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCelebration } from '@/components/CelebrationProvider';
import { HUNT_ITEMS } from '@/data/items';
import { ensureAppDirs } from '@/lib/files';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { getLatestCaptureForItem, insertCapture, updateCaptureLocation } from '@/lib/db';
import { getSingleLocationOrNull, extractGpsFromExif, ensureWhenInUsePermission } from '@/lib/location';
import { CaptureCard } from '@/components/CaptureCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HuntGridScreen() {
  const { celebrate } = useCelebration();
  const [version, setVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [optimisticThumbUri, setOptimisticThumbUri] = useState<string | null>(null);

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
});
