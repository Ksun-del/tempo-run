/** Хранилище пробежек в приложении (Android) — обычное AsyncStorage */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const kv = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
