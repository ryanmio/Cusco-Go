import { Platform, NativeModules } from 'react-native';

// Single leaderboard identifier: replace with your ASC leaderboard ID
export const LEADERBOARD_ID = 'cuscogoleaderboard1';

type GameCenterModule = any; // Using any to avoid type dependency on the native module

let cachedModule: GameCenterModule | null | undefined = undefined;
function getGameCenter(): GameCenterModule | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-game-center');
    cachedModule = mod?.default ?? mod ?? null;
  } catch {
    const nm: any = (NativeModules as any) || {};
    cachedModule = nm.GameCenter || nm.RNGameCenter || null;
  }
  return cachedModule;
}

export async function authenticateGameCenter(): Promise<boolean> {
  const gc = getGameCenter();
  if (!gc) return false;
  try {
    if (typeof gc.authenticateLocalPlayer === 'function') {
      const ok = await gc.authenticateLocalPlayer();
      return Boolean(ok);
    }
    if (typeof gc.signIn === 'function') {
      await gc.signIn();
      return true;
    }
    if (typeof gc.authenticate === 'function') {
      await gc.authenticate();
      return true;
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
      try {
        const ok = await gc.submitScore(Math.max(0, Math.floor(score)), leaderboardId);
        return Boolean(ok ?? true);
      } catch {
        await gc.submitScore({ leaderboardId, score: Math.max(0, Math.floor(score)) });
        return true;
      }
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
    if (typeof gc.showLeaderboard === 'function') {
      await gc.showLeaderboard(leaderboardId);
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


