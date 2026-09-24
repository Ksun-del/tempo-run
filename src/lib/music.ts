import { Linking } from 'react-native';

/** Открыть Яндекс Музыку: приложение, а если его нет — сайт */
export async function openMusic() {
  try {
    await Linking.openURL('yandexmusic://');
  } catch {
    Linking.openURL('https://music.yandex.ru').catch(() => {});
  }
}
