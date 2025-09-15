import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Circle } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import * as Network from 'expo-network';
import { addCapturesListener, listCaptures } from '@/lib/db';
import { getSingleLocationOrNull } from '@/lib/location';
import { listBiomes, CircleBiome } from '@/lib/biomes';

export default function MapTab() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [points, setPoints] = useState<{ id: number; latitude: number; longitude: number; title: string }[]>([]);
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBiome, setSelectedBiome] = useState<CircleBiome | null>(null);
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
    const raw = rows
      .filter(r => r.latitude != null && r.longitude != null)
      .map(r => ({ id: r.id, latitude: r.latitude as number, longitude: r.longitude as number, title: r.title }));
    setPoints(spreadOverlappingPoints(raw));
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
      >
        {circles.map(b => {
          const strokeColor = goldColor(b.multiplier, 1);
          const fillColor = goldColor(b.multiplier, 0.28);
          return (
            <React.Fragment key={`biome-${b.id}`}>
              <Circle
                center={{ latitude: b.centerLat, longitude: b.centerLng }}
                radius={b.radiusMeters}
                strokeWidth={2}
                strokeColor={strokeColor}
                fillColor={fillColor}
                zIndex={2}
                tappable={true}
                onPress={() => setSelectedBiome(b)}
              />
              <Marker
                coordinate={{ latitude: b.centerLat, longitude: b.centerLng }}
                onPress={() => setSelectedBiome(b)}
                zIndex={3}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={{ width: 1, height: 1, backgroundColor: 'transparent' }} />
              </Marker>
            </React.Fragment>
          );
        })}
        {points.map(p => (
          <Marker 
            key={p.id} 
            coordinate={{ latitude: p.latitude, longitude: p.longitude }} 
            title={p.title}
            pinColor="red"
          />
        ))}
      </MapView>
      <View style={styles.zoomHint}>
        <Text style={styles.zoomHintText}>Pinch to zoom • Drag to pan</Text>
      </View>
      {selectedBiome ? (
        <View style={styles.biomeCardWrap} pointerEvents="box-none">
          <View style={styles.biomeCard} accessibilityRole="summary">
            <Text style={styles.biomeTitle}>{selectedBiome.label}</Text>
            <Text style={styles.biomeSubtitle}>Multiplier ×{selectedBiome.multiplier.toFixed(1)}</Text>
            <TouchableOpacity onPress={() => setSelectedBiome(null)} style={styles.biomeCloseBtn} accessibilityRole="button" accessibilityLabel="Close biome info">
              <Text style={styles.biomeCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
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
    bottom: 24,
    alignItems: 'center',
  },
  biomeCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  biomeTitle: { color: 'white', fontSize: 16, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  biomeSubtitle: { color: 'white', fontSize: 14, fontWeight: '700', opacity: 0.9, textAlign: 'center' },
  biomeCloseBtn: { marginTop: 10, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  biomeCloseText: { color: 'white', fontWeight: '800' },
});

