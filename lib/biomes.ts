const biomesJson = require('@/data/biomes.json');

export type CircleBiome = {
  id: string;
  label: string;
  type: 'circle';
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  multiplier: number; // e.g., 1.5 means +50% bonus
  description?: string; // optional short description from biomes.json
};

export type AltitudeBiome = {
  id: string;
  label: string;
  type: 'altitude';
  minMeters?: number; // inclusive
  maxMeters?: number; // inclusive
  multiplier: number;
  description?: string; // optional short description from biomes.json
};

export type Biome = CircleBiome | AltitudeBiome;

export function listBiomes(): Biome[] {
  return (biomesJson as unknown) as Biome[];
}

export type BiomeMatch = {
  biome: Biome;
  distanceMeters?: number; // for circle
};

// Haversine distance in meters
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000; // mean Earth radius
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findBestBiomeForLocation(latitude: number | null | undefined, longitude: number | null | undefined): BiomeMatch | null {
  if (latitude == null || longitude == null) return null;
  const biomes = listBiomes();
  let best: BiomeMatch | null = null;
  for (const biome of biomes) {
    if (biome.type === 'circle') {
      const d = distanceMeters(latitude, longitude, biome.centerLat, biome.centerLng);
      if (d <= (biome.radiusMeters)) {
        if (!best || biome.multiplier > (best.biome as any).multiplier) {
          best = { biome, distanceMeters: d };
        }
      }
    }
    // Altitude types could be added later using device altitude if available
  }
  return best;
}

export function computeBonusPoints(basePoints: number, multiplier: number): number {
  // multiplier 1.0 means no bonus; bonus = base * (multiplier - 1)
  const extra = Math.round(basePoints * (multiplier - 1));
  return Math.max(0, extra);
}
