import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

const KEY = 'run:install-hint-hidden';

function shouldShow() {
  try {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return !standalone && localStorage.getItem(KEY) !== '1';
  } catch {
    return false;
  }
}

/** Подсказка в браузере: как добавить RUN на экран «Домой» */
export default function InstallHint() {
  const [show, setShow] = useState(shouldShow);
  if (!show) return null;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hide = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setShow(false);
  };
  return (
    <View style={styles.box}>
      <Ionicons name={ios ? 'share-outline' : 'add-circle-outline'} size={22} color={colors.accent} />
      <Text style={styles.text}>
        {ios
          ? 'Добавь RUN на экран «Домой»: нажми «Поделиться» внизу Safari → «На экран „Домой“».'
          : 'Добавь RUN на главный экран: меню браузера → «Добавить на главный экран».'}
      </Text>
      <Pressable onPress={hide} hitSlop={10}>
        <Ionicons name="close" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,185,0,0.4)',
  },
  text: { flex: 1, fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 13, lineHeight: 18 },
});
