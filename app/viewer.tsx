import { useLocalSearchParams, router } from 'expo-router';
import { Alert, Image, StyleSheet, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useEffect } from 'react';
import { removeFileIfExists } from '@/lib/files';
import { deleteCapture } from '@/lib/db';
import { FullScreenActions } from '@/components/FullScreenActions';
 

export default function Viewer() {
  const { uri } = useLocalSearchParams<{ uri: string }>();

  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Ensure permission prompt happens when saving
    MediaLibrary.getPermissionsAsync();
  }, []);

  async function onSave() {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync({ writeOnly: true } as any);
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to Photos to save images.');
        return;
      }
      
      if (uri) {
        await MediaLibrary.saveToLibraryAsync(String(uri));
        Alert.alert('Saved!', 'Photo saved to your Photos library.');
      }
    } catch (error) {
      Alert.alert('Save Failed', 'Could not save photo to Photos library.');
    }
  }

  async function onShare() {
    if (uri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(String(uri));
    }
  }

  async function onDelete() {
    Alert.alert('Delete this photo?', 'This will permanently delete this photo and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!uri) return;
          
          // Find the capture by originalUri to get the ID
          const { listCaptures } = await import('@/lib/db');
          const captures = listCaptures();
          const capture = captures.find(c => c.originalUri === uri);
          
          if (capture) {
            // Delete files
            await removeFileIfExists(capture.originalUri);
            await removeFileIfExists(capture.thumbnailUri);
            // Delete from database
            deleteCapture(capture.id);
          } else {
            // Fallback: just delete the file
            await removeFileIfExists(String(uri));
          }
          
          router.back();
        }
      }
    ]);
  }

  if (!uri) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>No image URI provided</Text>
      </View>
    );
  }

  const bottomOverlaySpace = 12 + Math.max(insets.bottom, 12) + 56;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <View style={{ flex: 1 }}>
        <View style={[styles.frame, { bottom: bottomOverlaySpace }]}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bouncesZoom
            centerContent
          >
            <Image
              source={{ uri: String(uri) }}
              style={styles.image}
              resizeMode="contain"
            />
          </ScrollView>
        </View>
        <FullScreenActions onSave={onSave} onShare={onShare} onDelete={onDelete} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  image: { 
    width: '100%', 
    height: '100%',
    minHeight: 300,
    minWidth: 300,
  },
});

