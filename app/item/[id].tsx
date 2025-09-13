import { useLocalSearchParams, router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, ActionSheetIOS, Alert } from 'react-native';
import { useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { HUNT_ITEMS } from '@/data/items';
import { getLatestCaptureForItem, deleteCapture } from '@/lib/db';
import { ensureAppDirs } from '@/lib/files';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { getSingleLocationOrNull, extractGpsFromExif, ensureWhenInUsePermission } from '@/lib/location';
import { removeFileIfExists } from '@/lib/files';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = HUNT_ITEMS.find(i => i.id === id);
  const latestCapture = id ? getLatestCaptureForItem(id) : null;

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
            const saved = await saveOriginalAndSquareThumbnail(result.assets[0].uri, `${item?.id}_${stamp}`);
            
            // Update database
            deleteCapture(latestCapture.id);
            const { insertCapture } = await import('@/lib/db');
            insertCapture({
              itemId: item?.id || '',
              title: item?.title || '',
              originalUri: saved.originalUri,
              thumbnailUri: saved.thumbnailUri,
              createdAt: stamp,
              latitude: loc?.latitude ?? null,
              longitude: loc?.longitude ?? null,
            });
            
            router.replace(`/item/${item?.id}`);
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

  async function onCapture() {
    if (!item) return;
    
    // Request permissions and pre-warm location
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
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
            if (!cam.canceled) await handlePicked(cam.assets[0].uri, item.id, item.title, cam.assets[0].exif ?? null);
          } else if (index === 2) {
            const lib = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 1, exif: true });
            if (!lib.canceled) await handlePicked(lib.assets[0].uri, item.id, item.title, lib.assets[0].exif ?? null);
          }
        } catch (e: any) {
          Alert.alert('Capture failed', String(e?.message ?? e));
        }
      }
    );
  }

  async function handlePicked(uri: string, itemId: string, title: string, pickedExif?: any | null) {
    const stamp = Date.now();
    // Start EXIF parse immediately
    const exifGps = extractGpsFromExif(pickedExif);
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
      latitude: exifGps?.latitude ?? null,
      longitude: exifGps?.longitude ?? null,
    });
    
    // Navigate to the item's page to show the new capture
    router.replace(`/item/${itemId}`);
    
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
