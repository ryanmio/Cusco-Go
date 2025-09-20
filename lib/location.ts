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

    // Fresh fix only
    const accuracy = __DEV__ ? Location.Accuracy.Balanced : Location.Accuracy.High;
    const pos = await Location.getCurrentPositionAsync({ 
      accuracy,
      mayShowUserSettingsDialog: true
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch (error) {
    return null;
  }
}

// Silent variant: only attempts a fix if permission is already granted. Never prompts.
export async function getSingleLocationIfPermitted() {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== Location.PermissionStatus.GRANTED) return null;
    const accuracy = __DEV__ ? Location.Accuracy.Balanced : Location.Accuracy.High;
    const pos = await Location.getCurrentPositionAsync({ 
      accuracy,
      mayShowUserSettingsDialog: true
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

// Best-effort EXIF GPS extraction from an ImagePicker asset's EXIF block
// Returns null if coordinates are missing or malformed
export function extractGpsFromExif(exif: any): { latitude: number; longitude: number } | null {
  if (!exif) return null;

  function toNumber(value: any): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (Array.isArray(value) && value.length >= 1) {
      // Some EXIF libs encode [deg, min, sec]
      const [deg, min = 0, sec = 0] = value as any[];
      const d = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
      return isFinite(d) ? d : null;
    }
    if (typeof value === 'string') {
      // Strings like "12,34,56" or "12/1,34/1,56/1"
      const parts = value
        .split(',')
        .map((p) => p.trim())
        .map((p) => {
          if (p.includes('/')) {
            const [n, d] = p.split('/').map((x) => Number(x));
            return d ? n / d : Number(n);
          }
          return Number(p);
        });
      if (parts.length === 1) {
        const n = parts[0];
        return isFinite(n) ? n : null;
      }
      const [deg, min = 0, sec = 0] = parts;
      const d = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
      return isFinite(d) ? d : null;
    }
    return null;
  }

  // Common EXIF keys
  const latRaw = exif.GPSLatitude ?? exif.gpsLatitude ?? exif.latitude;
  const lonRaw = exif.GPSLongitude ?? exif.gpsLongitude ?? exif.longitude;
  const latRef = (exif.GPSLatitudeRef ?? exif.gpsLatitudeRef ?? '').toString().toUpperCase();
  const lonRef = (exif.GPSLongitudeRef ?? exif.gpsLongitudeRef ?? '').toString().toUpperCase();

  let lat = toNumber(latRaw);
  let lon = toNumber(lonRaw);

  if (lat == null || lon == null) return null;
  if (latRef === 'S') lat = -Math.abs(lat);
  if (lonRef === 'W') lon = -Math.abs(lon);

  if (!isFinite(lat) || !isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

