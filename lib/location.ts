import * as Location from 'expo-location';

export async function ensureWhenInUsePermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.status === Location.PermissionStatus.GRANTED;
}

export async function getSingleLocationOrNull() {
  try {
    const ok = await ensureWhenInUsePermission();
    if (!ok) return null;
    
    // Use higher accuracy for real devices, balanced for simulator
    const accuracy = __DEV__ ? Location.Accuracy.Balanced : Location.Accuracy.High;
    const pos = await Location.getCurrentPositionAsync({ 
      accuracy,
      maximumAge: 10000, // 10 seconds
      timeout: 15000 // 15 seconds
    });
    
    // Simulator often returns California coordinates - this is expected
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch (error) {
    console.log('Location error:', error);
    return null;
  }
}

