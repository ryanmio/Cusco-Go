import { useLocalSearchParams, router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, ActionSheetIOS, Alert, findNodeHandle } from 'react-native';
import { useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { HUNT_ITEMS } from '@/data/items';
import { getLatestCaptureForItem, deleteCapture } from '@/lib/db';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { getSingleLocationOrNull, extractGpsFromExif, ensureWhenInUsePermission } from '@/lib/location';
import { removeFileIfExists } from '@/lib/files';
import GlassSurface from '@/components/GlassSurface';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

// Extract photo taken date from EXIF data
function extractPhotoDateFromExif(exif: any | null): number | null {
  if (!exif) return null;

  const dateFields = ['DateTimeOriginal', 'DateTime', 'DateTimeDigitized'];
  let dateStr: string | undefined;
  for (const field of dateFields) {
    const candidate = exif[field];
    if (typeof candidate === 'string' && candidate.length >= 19) {
      dateStr = candidate;
      break;
    }
  }

  const offset: string | undefined = exif.OffsetTimeOriginal || exif.OffsetTimeDigitized || exif.OffsetTime;
  const subsec: string | undefined = exif.SubsecTimeOriginal || exif.SubsecTimeDigitized || exif.SubSecTime;

  if (dateStr) {
    // Convert only date part colons to dashes
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

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = HUNT_ITEMS.find(i => i.id === id);
  const latestCapture = id ? getLatestCaptureForItem(id) : null;
  const menuButtonRef = useRef<View>(null);
  const colorScheme = useColorScheme();

  const CHIP = {
    effect: 'clear' as const,
    tint: 'rgba(0,0,0,0.0)',
    bg: '#2B2222',
    textColor: '#fff',
  };

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Item not found</Text>
      </View>
    );
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
        // Anchor to the menu button (especially important on iPad)
        anchor: findNodeHandle(menuButtonRef.current) ?? undefined,
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
        anchor: findNodeHandle(menuButtonRef.current) ?? undefined,
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
            const saved = await saveOriginalAndSquareThumbnail(result.assets[0].uri, `${item?.id}_${stamp}`);
            
            // Extract photo date from EXIF
            const photoTakenAt = extractPhotoDateFromExif(result.assets[0].exif ?? null) || stamp;
            
            // Update database
            deleteCapture(latestCapture.id);
            const { insertCapture } = await import('@/lib/db');
            insertCapture({
              itemId: item?.id || '',
              title: item?.title || '',
              originalUri: saved.originalUri,
              thumbnailUri: saved.thumbnailUri,
              createdAt: stamp,
              photoTakenAt: photoTakenAt,
              latitude: loc?.latitude ?? null,
              longitude: loc?.longitude ?? null,
            });

            // Silent background save to Photos if this replacement came from camera
            if (index === 1) {
              await ensurePhotosPermissionRequestedOnce();
              silentlySaveToPhotosIfPermitted(saved.originalUri);
            }
            
            router.replace(`/item/${item?.id}`);
          }
        } catch (e: any) {
          Alert.alert('Replace failed', String(e?.message ?? e));
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

  async function onCapture() {
    if (!item) return;
    
    try {
      // Request camera permission and pre-warm location
      await ImagePicker.requestCameraPermissionsAsync();
      await ensureWhenInUsePermission();
      
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1, exif: true });
      if (!result.canceled) {
        await ensurePhotosPermissionRequestedOnce();
        await handlePicked(result.assets[0].uri, item.id, item.title, result.assets[0].exif ?? null, true);
      }
    } catch (e: any) {
      Alert.alert('Capture failed', String(e?.message ?? e));
    }
  }

  async function handlePicked(uri: string, itemId: string, title: string, pickedExif?: any | null, isFromCamera: boolean = false) {
    const stamp = Date.now();
    // Start EXIF parse immediately
    const exifGps = extractGpsFromExif(pickedExif);
    const photoTakenAt = extractPhotoDateFromExif(pickedExif) || stamp; // Use EXIF date or fallback to current time
    // Save files first for snappier UI, then fetch GPS if needed
    const saved = await saveOriginalAndSquareThumbnail(uri, `${itemId}_${stamp}`);
    
    // Insert row with whatever location we have synchronously (EXIF or null)
    const { insertCapture } = await import('@/lib/db');
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
    
    // Navigate to the item's page to show the new capture
    router.replace(`/item/${itemId}`);

    if (isFromCamera) {
      silentlySaveToPhotosIfPermitted(saved.originalUri);
    }
    
    // If no EXIF GPS, resolve a fresh fix in the background and update row
    if (!exifGps) {
      getSingleLocationOrNull().then((loc) => {
        if (loc) {
          const { updateCaptureLocation } = require('@/lib/db');
          updateCaptureLocation(id, loc.latitude, loc.longitude);
        }
      });
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Image 
          source={latestCapture ? { uri: latestCapture.thumbnailUri } : item.placeholder} 
          style={styles.image} 
          resizeMode="cover" 
        />
        {latestCapture && (
          <>
            <GlassSurface glassEffectStyle={CHIP.effect} isInteractive style={[styles.glassActionChip, { backgroundColor: CHIP.bg }]} tintColor={CHIP.tint}>
              <Pressable style={styles.glassPressable} onPress={onViewPhoto}>
                <Text style={[styles.viewButtonText, { color: CHIP.textColor }]}>View Full Size</Text>
              </Pressable>
            </GlassSurface>
            <GlassSurface glassEffectStyle={CHIP.effect} isInteractive style={[styles.glassActionChip, styles.glassMenuChip, { backgroundColor: CHIP.bg }]} tintColor={CHIP.tint}>
              <Pressable ref={menuButtonRef} style={styles.glassPressable} onPress={onMenuPress}>
                <Text style={[styles.viewButtonText, { color: CHIP.textColor }]}>⋯</Text>
              </Pressable>
            </GlassSurface>
          </>
        )}
        {!latestCapture && (
          <GlassSurface
            glassEffectStyle={CHIP.effect}
            isInteractive
            tintColor={CHIP.tint}
            style={[styles.glassActionChip, { backgroundColor: CHIP.bg } ]}
          >
            <Pressable style={styles.glassPressable} onPress={onCapture}>
              <Text style={[styles.viewButtonText, { color: CHIP.textColor }]}>Capture Photo</Text>
            </Pressable>
          </GlassSurface>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.categoryContainer}>
          <Text style={styles.category}>{(item.category === 'place' ? 'RUIN' : item.category.toUpperCase())}</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
        
        {!latestCapture && null}
      </View>
    </ScrollView>
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
  glassActionChip: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassMenuChip: {
    top: 16,
    bottom: undefined,
  },
  glassPressable: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  glassBlueFallback: {
    backgroundColor: 'rgba(10,132,255,0.24)',
    borderColor: 'rgba(10,132,255,0.4)',
  },
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
