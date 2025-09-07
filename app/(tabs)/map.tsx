import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import * as Network from 'expo-network';
import { listCaptures } from '@/lib/db';

export default function MapTab() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [points, setPoints] = useState<{ id: number; latitude: number; longitude: number; title: string }[]>([]);

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
    }, [])
  );

  function loadPoints() {
    const rows = listCaptures();
    setPoints(rows.filter(r => r.latitude && r.longitude).map(r => ({ id: r.id, latitude: r.latitude!, longitude: r.longitude!, title: r.title })));
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

  return (
    <View style={{ flex: 1 }}>
      <MapView 
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

