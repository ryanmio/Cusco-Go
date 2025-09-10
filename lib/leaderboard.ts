import { Platform } from 'react-native';

// Single leaderboard identifier: replace with your ASC leaderboard ID
export const LEADERBOARD_ID = 'cuscogoleaderboard1';

type GameCenterModule = any; // Using any to avoid type dependency on the native module

let cachedModule: GameCenterModule | null | undefined = undefined;

function getGameCenter(): GameCenterModule | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // Use react-native-game-center
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-game-center');
    cachedModule = mod ?? mod?.default ?? null;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export async function authenticateGameCenter(): Promise<void> {
  const gc = getGameCenter();
  if (!gc) return;
  try {
    // Common method names across libraries
    if (typeof gc.signIn === 'function') {
      await gc.signIn();
    } else if (typeof gc.login === 'function') {
      await gc.login();
    } else if (typeof gc.authenticate === 'function') {
      await gc.authenticate();
    }
  } catch {
    // ignore auth errors; user may be signed out of Game Center
  }
}

export async function submitTotalScore(score: number): Promise<void> {
  const gc = getGameCenter();
  if (!gc) return;
  const leaderboardId = LEADERBOARD_ID;
  if (!leaderboardId) return;
  try {
    // react-native-games-services
    if (typeof gc.submitScore === 'function') {
      await gc.submitScore({ leaderboardId, score: Math.max(0, Math.floor(score)) });
      return;
    }
    // Alternate signature some libs use
    if (typeof gc.postScore === 'function') {
      await gc.postScore({ leaderboardId, score: Math.max(0, Math.floor(score)) });
      return;
    }
    if (typeof gc.reportScore === 'function') {
      await gc.reportScore(Math.max(0, Math.floor(score)), leaderboardId);
      return;
    }
  } catch {
    // swallow errors to avoid UI disruption
  }
}

export async function showLeaderboards(): Promise<boolean> {
  const gc = getGameCenter();
  if (!gc) return false;
  const leaderboardId = LEADERBOARD_ID;
  try {
    if (typeof gc.showLeaderboard === 'function') {
      await gc.showLeaderboard(leaderboardId);
      return true;
    }
    if (typeof gc.showLeaderboards === 'function') {
      await gc.showLeaderboards({ leaderboardId });
      return true;
    }
    if (typeof gc.openLeaderboard === 'function') {
      await gc.openLeaderboard(leaderboardId);
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
    await submitTotalScore(1);
    return true;
  } catch {
    return false;
  }
}


