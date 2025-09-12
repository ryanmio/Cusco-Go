import * as ImageManipulator from 'expo-image-manipulator';
import { originalsDirUri, thumbsDirUri } from './files';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';

export type SavedImagePaths = {
  originalUri: string;
  thumbnailUri: string;
};

export async function saveOriginalAndSquareThumbnail(sourceUri: string, filenameStem: string): Promise<SavedImagePaths> {
  const originalDest = `${originalsDirUri()}${filenameStem}.jpg`;
  const thumbDest = `${thumbsDirUri()}${filenameStem}_thumb.jpg`;

  // Save original as JPEG (keep size) to normalize format
  const original = await ImageManipulator.manipulateAsync(
    sourceUri,
    [],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  await FileSystem.copyAsync({ from: original.uri, to: originalDest });

  // Create square ~1024px thumbnail with SAFE cover strategy
  const baseSize = await getImageSizeAsync(sourceUri);
  const target = 1024;
  // Scale so the shorter side >= target
  const scale = Math.max(target / baseSize.width, target / baseSize.height);
  const newW = Math.ceil(baseSize.width * scale);
  const newH = Math.ceil(baseSize.height * scale);

  const thumbBase = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: newW, height: newH } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const baseW = Math.max(1, Math.round(thumbBase.width ?? newW));
  const baseH = Math.max(1, Math.round(thumbBase.height ?? newH));
  const cropSide = Math.min(target, baseW, baseH);
  let originX = Math.floor((baseW - cropSide) / 2);
  let originY = Math.floor((baseH - cropSide) / 2);
  originX = Math.max(0, Math.min(originX, baseW - cropSide));
  originY = Math.max(0, Math.min(originY, baseH - cropSide));

  let thumbSquare;
  try {
    thumbSquare = await ImageManipulator.manipulateAsync(
      thumbBase.uri,
      [{ crop: { originX, originY, width: cropSide, height: cropSide } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
  } catch (e) {
    // Fallback: if crop ever fails, just use the resized image
    thumbSquare = thumbBase;
  }

  await FileSystem.copyAsync({ from: thumbSquare.uri, to: thumbDest });

  return { originalUri: originalDest, thumbnailUri: thumbDest };
}

function getImageSizeAsync(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

