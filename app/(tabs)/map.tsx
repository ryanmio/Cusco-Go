import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import * as Network from 'expo-network';
import { addCapturesListener, listCaptures } from '@/lib/db';

export default function MapTab() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [points, setPoints] = useState<{ id: number; latitude: number; longitude: number; title: string }[]>([]);
  const mapRef = useRef<MapView | null>(null);

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
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        mapType="standard"
      >
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
});

