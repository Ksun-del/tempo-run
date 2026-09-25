/** Сохранение карточки на телефоне (Android): картинка → галерея / меню «Поделиться» */
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const webShareHint = '';

async function capture(node: View, ratio: number) {
  return captureRef(node, { format: 'jpg', quality: 0.95, width: 1080, height: Math.round(1080 * ratio), result: 'tmpfile' });
}

export async function saveCard(node: View, ratio: number): Promise<'saved' | 'denied'> {
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) return 'denied';
  await MediaLibrary.saveToLibraryAsync(await capture(node, ratio));
  return 'saved';
}

export async function shareCard(node: View, ratio: number): Promise<'shared' | 'unavailable'> {
  const uri = await capture(node, ratio);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Поделиться тренировкой' });
  return 'shared';
}
