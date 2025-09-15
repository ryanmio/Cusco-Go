import { computeBonusPoints, findBestBiomeForLocation } from '@/lib/biomes';
import { insertBonusEvent } from '@/lib/db';

export async function evaluateAndRecordBiomeBonus(params: {
  captureId: number;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  basePoints: number;
}): Promise<{ awarded: boolean; bonusPoints: number; biomeLabel?: string; multiplier?: number }> {
  const { captureId, latitude, longitude, basePoints } = params;
  const best = findBestBiomeForLocation(latitude ?? null, longitude ?? null);
  if (!best) return { awarded: false, bonusPoints: 0 };
  const multiplier = best.biome.multiplier;
  const bonusPoints = computeBonusPoints(basePoints, multiplier);
  if (bonusPoints <= 0) return { awarded: false, bonusPoints: 0 };
  insertBonusEvent({
    id: 0 as any, // ignored by insert
    captureId,
    biomeId: best.biome.id,
    biomeLabel: best.biome.label,
    multiplier,
    bonusPoints,
    createdAt: Date.now(),
  } as any);
  return { awarded: true, bonusPoints, biomeLabel: best.biome.label, multiplier };
}
