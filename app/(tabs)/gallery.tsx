import React, { useEffect, useState, useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, Animated, Dimensions, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { listCaptures, CaptureRow } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import GlassSurface from '@/components/GlassSurface';

type DayGroup = {
  date: string;
  displayDate: string;
  photos: CaptureRow[];
};

export default function GalleryScreen() {
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: screenWidth } = Dimensions.get('window');
  const columnWidth = (screenWidth - 48) / 2; // 16px padding + 16px gap
  const insets = useSafeAreaInsets();

  const fadeAnim = useState(new Animated.Value(0))[0];
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});

  useEffect(() => {
    setRows(listCaptures());
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setRows(listCaptures());
    }, [])
  );

  // Resolve and cache original image aspect ratios to create stable, non-random layouts
  useEffect(() => {
    const missing = rows.filter(r => aspectRatios[r.id] === undefined);
    if (missing.length === 0) return;
    missing.forEach((row) => {
      Image.getSize(
        row.originalUri,
        (w, h) => {
          if (!w || !h) return;
          setAspectRatios(prev => ({ ...prev, [row.id]: h / w }));
        },
        () => {
          // Fallback to square if size cannot be determined
          setAspectRatios(prev => ({ ...prev, [row.id]: 1 }));
        }
      );
    });
  }, [rows]);

  const itemIdToItem = Object.fromEntries(HUNT_ITEMS.map(i => [i.id, i]));

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    return rows.filter(row => {
      const item = itemIdToItem[row.itemId];
      return item?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             item?.description.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [rows, searchQuery]);

  // Group photos by date
  const dayGroups = useMemo(() => {
    const groups: { [key: string]: CaptureRow[] } = {};
    
    filteredRows.forEach(row => {
      // Use photoTakenAt (when photo was taken) instead of createdAt (when added to app)
      const photoDate = row.photoTakenAt || row.createdAt;
      const date = new Date(photoDate);
      // Use YYYY-MM-DD format for consistent grouping
      const dateKey = date.toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(row);
    });

    return Object.entries(groups)
      .map(([dateKey, photos]) => {
        const date = new Date(dateKey + 'T00:00:00'); // Ensure consistent timezone
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset to start of day
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let displayDate: string;
        if (date.getTime() === today.getTime()) {
          displayDate = 'Today';
        } else if (date.getTime() === yesterday.getTime()) {
          displayDate = 'Yesterday';
        } else {
          displayDate = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });
        }
        
        return {
          date: dateKey,
          displayDate,
          photos: photos.sort((a, b) => new Date(b.photoTakenAt || b.createdAt).getTime() - new Date(a.photoTakenAt || a.createdAt).getTime())
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredRows]);

  const onRefresh = async () => {
    setRefreshing(true);
    setRows(listCaptures());
    setRefreshing(false);
  };

  function onImagePress(item: CaptureRow) {
    router.push(`/item/${item.itemId}`);
  }

  type PhotoCell = { photo: CaptureRow; height: number };

  // Masonry layout algorithm (supports variable columns and height scaling)
  function createMasonryLayout(photos: CaptureRow[], numColumns: number, heightScale: number, tileWidth: number, clampMin: number, clampMax: number): PhotoCell[][] {
    const columns: PhotoCell[][] = Array.from({ length: Math.max(1, numColumns) }, () => []);
    const columnHeights: number[] = Array.from({ length: Math.max(1, numColumns) }, () => 0);

    photos.forEach((photo) => {
      const ratio = aspectRatios[photo.id] ?? 1; // stable per-photo
      let height = Math.round(tileWidth * ratio * heightScale);
      height = Math.max(clampMin, Math.min(clampMax, height));

      // Find shortest column
      let shortestColumn = 0;
      for (let i = 1; i < columnHeights.length; i++) {
        if (columnHeights[i] < columnHeights[shortestColumn]) shortestColumn = i;
      }

      // Add photo to shortest column
      columns[shortestColumn].push({ photo, height });
      columnHeights[shortestColumn] += height + 8; // include gap
    });

    return columns;
  }

  function renderDayGroup(dayGroup: DayGroup) {
    const count = dayGroup.photos.length;
    const numColumns = count <= 3 ? 1 : 2;
    const heightScale = count <= 3 ? 1.0 : count <= 5 ? 0.95 : 0.85;
    const tileWidth = numColumns === 1 ? (screenWidth - 32) : columnWidth;
    // Clamp ranges by density; single-column allows very tall images
    const clampMin = numColumns === 1 ? 160 : 140;
    const clampMax = numColumns === 1 ? 640 : (count <= 5 ? 360 : 280);
    const columns = createMasonryLayout(dayGroup.photos, numColumns, heightScale, tileWidth, clampMin, clampMax);
    
    return (
      <Animated.View 
        key={dayGroup.date}
        style={[
          styles.dayGroup,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }
        ]}
      >
        {/* Day Header */}
        <View style={styles.dayHeader}>
          <Text style={[styles.dayTitle, { color: colors.text }]}>
            {dayGroup.displayDate}
          </Text>
          <Text style={[styles.dayCount, { color: colors.searchPlaceholder }]}>
            {dayGroup.photos.length} photo{dayGroup.photos.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Masonry Grid */}
        <View style={[styles.masonryContainer, { justifyContent: numColumns === 1 ? 'center' : 'space-between' }]}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {column.map((cell, cellIndex) => (
                <Animated.View
                  key={cell.photo.id}
                  style={[
                    styles.photoContainer,
                    {
                      width: tileWidth,
                      height: cell.height,
                      opacity: fadeAnim,
                      transform: [{
                        translateY: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        })
                      }]
                    }
                  ]}
                >
                  <GlassSurface
                    style={[
                      styles.glassPhoto,
                      { 
                        width: tileWidth,
                        height: cell.height,
                        
                      }
                    ]}
                    glassEffectStyle="regular"
                    isInteractive
                    tintColor={(colorScheme === 'dark') ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)'}
                  >
                    <Pressable 
                      style={styles.photoPressable} 
                      onPress={() => onImagePress(cell.photo)}
                      android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
                    >
                      <Image 
                        source={{ uri: cell.photo.originalUri }} 
                        style={styles.photoImage} 
                        resizeMode="cover" 
                      />
                    </Pressable>
                  </GlassSurface>
                </Animated.View>
              ))}
            </View>
          ))}
        </View>
      </Animated.View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <GlassSurface
          style={[styles.emptyCard]}
          glassEffectStyle="regular"
          isInteractive
          tintColor={(colorScheme === 'dark') ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)'}
        >
          <Text style={[styles.emptyIcon]}>📸</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>No photos yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.searchPlaceholder }]}>
            Start capturing to see your gallery
          </Text>
        </GlassSurface>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Apple Photos Style Gallery */}
      <ScrollView
        contentContainerStyle={[styles.galleryContainer, { paddingBottom: Math.max(96, insets.bottom + 96) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
          />
        }
      >
        {dayGroups.map(renderDayGroup)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  galleryContainer: {
    paddingBottom: 20,
  },
  dayGroup: {
    marginBottom: 32,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dayTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  dayCount: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  masonryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
    marginHorizontal: 4,
  },
  photoContainer: {
    marginBottom: 8,
  },
  glassPhoto: {
    borderRadius: 16,
    overflow: 'hidden',
    
  },
  photoPressable: {
    flex: 1,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyCard: {
    padding: 48,
    borderRadius: 28,
    alignItems: 'center',
    maxWidth: 280,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
  },
});

