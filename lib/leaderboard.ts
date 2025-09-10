import { Platform } from 'react-native';
import ExpoGameCenter from 'expo-game-center';

// Single leaderboard identifier: replace with your ASC leaderboard ID
export const LEADERBOARD_ID = 'cuscogoleaderboard1';

type GameCenterModule = any; // Using any to avoid type dependency on the native module

function getGameCenter(): GameCenterModule | null {
  if (Platform.OS !== 'ios') return null;
  return (ExpoGameCenter as unknown as GameCenterModule) ?? null;
}

export async function authenticateGameCenter(): Promise<boolean> {
  const gc = getGameCenter();
  if (!gc) return false;
  try {
    // Common method names across libraries
    if (typeof gc.authenticateLocalPlayer === 'function') {
      const ok = await gc.authenticateLocalPlayer();
      return Boolean(ok);
    }
    return false;
  } catch {
    return false;
  }
}

export async function submitTotalScore(score: number): Promise<boolean> {
  const gc = getGameCenter();
  if (!gc) return false;
  const leaderboardId = LEADERBOARD_ID;
  if (!leaderboardId) return false;
  try {
    if (typeof gc.submitScore === 'function') {
      const ok = await gc.submitScore(Math.max(0, Math.floor(score)), leaderboardId);
      return Boolean(ok);
    }
    return false;
  } catch {
    return false;
  }
}

export async function showLeaderboards(): Promise<boolean> {
  const gc = getGameCenter();
  if (!gc) return false;
  const leaderboardId = LEADERBOARD_ID;
  try {
    if (typeof gc.presentLeaderboard === 'function') {
      await gc.presentLeaderboard(leaderboardId);
      return true;
    }
    if (typeof gc.presentGameCenterViewController === 'function') {
      await gc.presentGameCenterViewController();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function isGameCenterAvailable(): boolean {
  return Platform.OS === 'ios' && Boolean(getGameCenter());
}

export async function getLocalPlayer(): Promise<
  | { playerId?: string; displayName?: string; alias?: string }
  | null
> {
  const gc = getGameCenter();
  if (!gc) return null;
  try {
    if (typeof gc.getPlayer === 'function') {
      return await gc.getPlayer();
    }
    if (typeof gc.getLocalPlayer === 'function') {
      return await gc.getLocalPlayer();
    }
    if (gc.player) {
      return gc.player;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function submitTestScoreOne(): Promise<boolean> {
  try {
    return await submitTotalScore(1);
  } catch {
    return false;
  }
}

export function getGameCenterDebugInfo(): { hasModule: boolean; methods: string[]; leaderboardId: string } {
  const mod = getGameCenter();
  const methods = mod ? Object.keys(mod).filter((k) => typeof (mod as any)[k] === 'function') : [];
  return { hasModule: Boolean(mod), methods, leaderboardId: LEADERBOARD_ID };
}


