import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Animated, Easing } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Circle, MapPressEvent } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import * as Network from 'expo-network';
import { addCapturesListener, listCaptures, type CaptureRow, listBonusEventsForCapture } from '@/lib/db';
import { HUNT_ITEMS } from '@/data/items';
import { getSingleLocationOrNull } from '@/lib/location';
import { listBiomes, CircleBiome, distanceMeters } from '@/lib/biomes';
import GlassSurface from '@/components/GlassSurface';
import { MapPin } from '@/components/MapPin';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function MapTab() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [online, setOnline] = useState<boolean | null>(null);
  const [captures, setCaptures] = useState<CaptureRow[]>([]);
  const [points, setPoints] = useState<{ id: number; latitude: number; longitude: number; title: string }[]>([]);
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBiome, setSelectedBiome] = useState<CircleBiome | null>(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const meRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFixAtRef = useRef<number>(0);
  const mapRef = useRef<MapView | null>(null);

  const circles = useMemo<CircleBiome[]>(() => (
    listBiomes().filter((b: any) => b.type === 'circle') as CircleBiome[]
  ), []);

  // Biome color scale (dull gold -> bright gold)
  const maxMult = useMemo(() => circles.reduce((m, b) => Math.max(m, b.multiplier), 1), [circles]);
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  function goldColor(multiplier: number, alpha = 1) {
    const low = { r: 176, g: 137, b: 0 };   // #B08900 (duller)
    const high = { r: 255, g: 209, b: 102 }; // #FFD166 (bright)
    const t = Math.max(0, Math.min(1, (multiplier - 1) / Math.max(1e-6, (maxMult - 1))));
    const r = Math.round(lerp(low.r, high.r, t));
    const g = Math.round(lerp(low.g, high.g, t));
    const b = Math.round(lerp(low.b, high.b, t));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    (async () => {
      const s = await Network.getNetworkStateAsync();
      setOnline(Boolean(s.isConnected && s.isInternetReachable));
      loadPoints();
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadPoints();
      // Refresh GPS fix if we don't have one or it is stale (> 5 minutes)
      const STALE_MS = 5 * 60 * 1000;
      const now = Date.now();
      const shouldRefresh = !lastFixAtRef.current || (now - lastFixAtRef.current) > STALE_MS;
      if (shouldRefresh) {
        (async () => {
          const loc = await getSingleLocationOrNull();
          if (loc) {
            setMe(loc);
            lastFixAtRef.current = Date.now();
            mapRef.current?.animateToRegion({
              latitude: loc.latitude,
              longitude: loc.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }, 600);
          }
        })();
      }
      const unsubscribe = addCapturesListener(() => {
        loadPoints();
      });
      return unsubscribe;
    }, [])
  );

  function loadPoints() {
    const rows = listCaptures();
    setCaptures(rows);
    const raw = rows
      .filter(r => r.latitude != null && r.longitude != null)
      .map(r => ({ id: r.id, latitude: r.latitude as number, longitude: r.longitude as number, title: r.title }));
    setPoints(spreadOverlappingPoints(raw));
    // Reset animations when reloading
    fadeAnim.setValue(0);
    slideAnim.setValue(12);
  }

  // Slightly offset markers that share the exact same rounded coordinates to avoid stacking
  function spreadOverlappingPoints(
    pts: { id: number; latitude: number; longitude: number; title: string }[]
  ): { id: number; latitude: number; longitude: number; title: string }[] {
    const groups = new Map<string, { id: number; latitude: number; longitude: number; title: string }[]>();
    for (const p of pts) {
      const key = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }
    const adjusted: { id: number; latitude: number; longitude: number; title: string }[] = [];
    for (const [, arr] of groups) {
      if (arr.length === 1) {
        adjusted.push(arr[0]);
        continue;
      }
      const n = arr.length;
      const radiusDeg = 0.0002; // ~20-25 meters
      for (let i = 0; i < n; i++) {
        const base = arr[i];
        const angle = (2 * Math.PI * i) / n;
        const latOffset = radiusDeg * Math.cos(angle);
        const lonScale = Math.cos((base.latitude * Math.PI) / 180) || 1;
        const lonOffset = (radiusDeg * Math.sin(angle)) / lonScale;
        adjusted.push({
          ...base,
          latitude: base.latitude + latOffset,
          longitude: base.longitude + lonOffset,
        });
      }
    }
    return adjusted;
  }

  // Fit map to show all markers whenever they change
  useEffect(() => {
    if (!online || points.length === 0) return;
    const coords = points.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [online, points]);

  function onMapPress(e: MapPressEvent) {
    const { coordinate } = e.nativeEvent;
    // Hit-test tap against biome circles
    const inside = circles
      .map(b => ({ b, d: distanceMeters(coordinate.latitude, coordinate.longitude, b.centerLat, b.centerLng) }))
      .filter(x => x.d <= x.b.radiusMeters);
    if (inside.length > 0) {
      // Pick highest multiplier; tie-breaker nearest
      inside.sort((a, b) => (b.b.multiplier - a.b.multiplier) || (a.d - b.d));
      setSelectedBiome(inside[0].b);
      // Ensure only one card is visible at a time
      setSelectedCaptureId(null);
      // Hide any item animation
      fadeAnim.setValue(0);
      slideAnim.setValue(12);
    } else {
      setSelectedBiome(null);
    }
  }

  if (!online) {
    return (
      <View style={styles.center}> 
        <Text style={styles.offlineText}>Map requires internet for tiles.</Text>
        <Text style={styles.offlineSubtext}>Captures still work offline.</Text>
        <Text style={styles.offlineNote}>Note: Simulator shows San Francisco coordinates by default.</Text>
      </View>
    );
  }

  // Default region (Machu Picchu area) - always use this for better UX
  const region = {
    latitude: -13.1631,
    longitude: -72.5450,
    latitudeDelta: 0.5, // Wider view
    longitudeDelta: 0.5,
  };

  const textColor = (colorScheme === 'dark') ? '#fff' : '#111';
  const fallbackGlass = (colorScheme === 'dark') ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';
  const glassTint = (colorScheme === 'dark') ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.16)';

  return (
    <View style={{ flex: 1 }}>
      <MapView 
        ref={mapRef}
        style={StyleSheet.absoluteFill} 
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation={!!me}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        mapType="standard"
        onPress={onMapPress}
      >
        {circles.map(b => {
          const strokeColor = goldColor(b.multiplier, 1);
          const fillColor = goldColor(b.multiplier, 0.28);
          return (
            <Circle
              key={`biome-${b.id}`}
              center={{ latitude: b.centerLat, longitude: b.centerLng }}
              radius={b.radiusMeters}
              strokeWidth={2}
              strokeColor={strokeColor}
              fillColor={fillColor}
              zIndex={2}
            />
          );
        })}
        {points.map(p => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            centerOffset={{ x: 0, y: -12 }}
            tracksViewChanges={false}
            zIndex={3}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedBiome(null);
              setSelectedCaptureId(p.id);
              // Animate card in
              fadeAnim.setValue(0);
              slideAnim.setValue(12);
              Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              ]).start();
            }}
          >
            <MapPin label={p.title} />
          </Marker>
        ))}
      </MapView>
      <View style={styles.zoomHint}>
        <Text style={styles.zoomHintText}>Pinch to zoom • Drag to pan</Text>
      </View>
      {selectedBiome ? (
        <View style={styles.biomeCardWrap} pointerEvents="box-none" onStartShouldSetResponder={() => true} onResponderRelease={() => setSelectedBiome(null)}>
          <GlassSurface
            style={[styles.biomeGlass, { marginHorizontal: 16, alignSelf: 'stretch' }]}
            glassEffectStyle="regular"
            isInteractive
            tintColor={glassTint}
            fallbackStyle={{ backgroundColor: fallbackGlass }}
          >
            <View>
              <Text style={[styles.biomeTitle, { color: textColor }]} numberOfLines={1}>{selectedBiome.label}</Text>
              <Text style={[styles.biomeSubtitle, { color: textColor }]}>Multiplier ×{selectedBiome.multiplier.toFixed(1)}</Text>
              {Boolean((selectedBiome as any).description) ? (
                <Text style={{ color: textColor, opacity: 0.9, marginTop: 6 }} numberOfLines={3}>{(selectedBiome as any).description}</Text>
              ) : null}
            </View>
          </GlassSurface>
        </View>
      ) : null}

      {selectedCaptureId != null ? (
        <View style={styles.captureCardWrap} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedCaptureId(null)} />
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignSelf: 'stretch' }}
            pointerEvents="box-none"
          >
            <Pressable style={{ alignSelf: 'stretch' }} onPress={() => {
              const cap = captures.find(c => c.id === selectedCaptureId);
              if (cap) router.push({ pathname: '/item/[id]', params: { id: cap.itemId } });
            }}>
              <GlassSurface
                style={[styles.captureGlass, { marginHorizontal: 16 }]}
                glassEffectStyle="regular"
                isInteractive
                tintColor={glassTint}
                fallbackStyle={{ backgroundColor: fallbackGlass }}
              >
                <SelectedCaptureContent
                  capture={captures.find(c => c.id === selectedCaptureId) || null}
                  textColor={textColor}
                />
              </GlassSurface>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  offlineText: { fontSize: 18, fontWeight: '600', color: '#666', marginBottom: 8 },
  offlineSubtext: { fontSize: 14, color: '#999', marginBottom: 16 },
  offlineNote: { fontSize: 12, color: '#666', textAlign: 'center', fontStyle: 'italic' },
  zoomHint: { 
    position: 'absolute', 
    top: 16, 
    left: 16, 
    right: 16, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8 
  },
  zoomHintText: { color: 'white', fontSize: 12, textAlign: 'center' },
  biomeCardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 112,
    alignItems: 'center',
  },
  biomeGlass: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  biomeContent: { alignItems: 'center' },
  biomeTitle: { fontSize: 18, fontWeight: '900', marginBottom: 2, textAlign: 'center' },
  biomeSubtitle: { fontSize: 14, fontWeight: '800', opacity: 0.95, textAlign: 'center' },
  captureCardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'stretch',
  },
  captureGlass: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'stretch',
  },
});

function SelectedCaptureContent({ capture, textColor }: { capture: CaptureRow | null; textColor: string }) {
  const [bonusTotal, setBonusTotal] = React.useState(0);
  useEffect(() => {
    if (!capture) { setBonusTotal(0); return; }
    const all = listBonusEventsForCapture(capture.id);
    setBonusTotal(all.reduce((s, b) => s + b.bonusPoints, 0));
  }, [capture?.id]);
  if (!capture) return null as any;
  const base = getBasePointsForItemId(capture.itemId);
  const total = base + bonusTotal;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Image source={{ uri: capture.thumbnailUri }} style={{ width: 72, height: 72, borderRadius: 14 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: textColor, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{capture.title}</Text>
        <Text style={{ color: textColor, opacity: 0.9, marginTop: 4, fontWeight: '800' }}>{total} pts</Text>
        <View style={{ height: 8 }} />
      </View>
      <Text style={{ color: textColor, opacity: 0.8, fontSize: 20, fontWeight: '900', paddingHorizontal: 6 }}>›</Text>
    </View>
  );
}

function getBasePointsForItemId(itemId: string): number {
  const match = HUNT_ITEMS.find((i: any) => i.id === itemId);
  return match ? Number(match.difficulty) : 0;
}

