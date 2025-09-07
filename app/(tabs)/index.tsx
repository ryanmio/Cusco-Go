import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { HUNT_ITEMS } from '@/data/items';
import { ensureAppDirs } from '@/lib/files';
import { saveOriginalAndSquareThumbnail } from '@/lib/images';
import { getLatestCaptureForItem, insertCapture } from '@/lib/db';
import { getSingleLocationOrNull } from '@/lib/location';
import { CaptureCard } from '@/components/CaptureCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HuntGridScreen() {
  const [version, setVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      async (index) => {
        try {
          if (index === 1) {
            const cam = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
            if (!cam.canceled) await handlePicked(cam.assets[0].uri, itemId, title);
          } else if (index === 2) {
            const lib = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 1 });
            if (!lib.canceled) await handlePicked(lib.assets[0].uri, itemId, title);
          }
        } catch (e: any) {
          Alert.alert('Capture failed', String(e?.message ?? e));
        }
      }
    );
  }

  async function handlePicked(uri: string, itemId: string, title: string) {
    const loc = await getSingleLocationOrNull();
    const stamp = Date.now();
    const saved = await saveOriginalAndSquareThumbnail(uri, `${itemId}_${stamp}`);
    insertCapture({
      itemId,
      title,
      originalUri: saved.originalUri,
      thumbnailUri: saved.thumbnailUri,
      createdAt: stamp,
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
    });
    setVersion(v => v + 1);
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
    return (
      <CaptureCard 
        id={item.id} 
        title={item.title} 
        placeholder={item.placeholder} 
        onPress={() => onCardPress(item)} 
      />
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
});
