import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { Format } from '../components/card/model';

/** Выбрать фото для карточки с обрезкой под формат. Возвращает адрес фото или null. */
export async function pickPhoto(source: 'camera' | 'library', format: Format): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: format === 'story' ? [9, 16] : [4, 5],
    quality: 0.9,
  };
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Нет доступа к камере', 'Разреши доступ к камере в настройках телефона.');
        return null;
      }
    }
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    return !res.canceled && res.assets[0] ? res.assets[0].uri : null;
  } catch (e) {
    Alert.alert('Не получилось открыть', String(e));
    return null;
  }
}
