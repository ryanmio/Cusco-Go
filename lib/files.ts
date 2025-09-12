import * as FileSystem from 'expo-file-system/legacy';

export async function ensureAppDirs() {
  const dataDir = `${FileSystem.documentDirectory}data/`;
  const originalsDir = `${dataDir}originals/`;
  const thumbsDir = `${dataDir}thumbs/`;
  for (const dir of [dataDir, originalsDir, thumbsDir]) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

export function originalsDirUri() {
  return `${FileSystem.documentDirectory}data/originals/`;
}

export function thumbsDirUri() {
  return `${FileSystem.documentDirectory}data/thumbs/`;
}

export async function removeFileIfExists(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {}
}

