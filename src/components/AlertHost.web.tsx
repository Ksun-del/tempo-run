/**
 * В браузере Alert.alert из React Native ничего не показывает.
 * Подменяем его своим окном в стиле приложения — так работают все подтверждения
 * («Завершить тренировку?», «Удалить?» и т.д.).
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { colors, fonts } from '../lib/theme';

type Dialog = { title: string; message?: string; buttons: AlertButton[] };
let push: ((d: Dialog) => void) | null = null;
const queue: Dialog[] = [];

Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const d = { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] };
  if (push) push(d);
  else queue.push(d);
};

export default function AlertHost() {
  const [list, setList] = useState<Dialog[]>([]);
  useEffect(() => {
    push = (d) => setList((l) => [...l, d]);
    if (queue.length) setList((l) => [...l, ...queue.splice(0)]);
    return () => {
      push = null;
    };
  }, []);
  const d = list[0];
  if (!d) return null;
  const close = (b?: AlertButton) => {
    setList((l) => l.slice(1));
    b?.onPress?.();
  };
  // «Отмена» — всегда последней и серой
  const buttons = [...d.buttons].sort((a, b) => (a.style === 'cancel' ? 1 : 0) - (b.style === 'cancel' ? 1 : 0));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(d.buttons.find((b) => b.style === 'cancel'))}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>{d.title}</Text>
          {!!d.message && <Text style={styles.message}>{d.message}</Text>}
          <View style={styles.buttons}>
            {buttons.map((b, i) => (
              <Pressable
                key={i}
                onPress={() => close(b)}
                style={({ pressed }) => [
                  styles.btn,
                  b.style === 'cancel' ? styles.btnCancel : b.style === 'destructive' ? styles.btnDanger : styles.btnMain,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.btnText, b.style !== 'cancel' && b.style !== 'destructive' && { color: colors.accentText }]}>{b.text ?? 'OK'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 22, padding: 20 },
  title: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 18 },
  message: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  buttons: { marginTop: 18, gap: 8 },
  btn: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  btnMain: { backgroundColor: colors.accent },
  btnDanger: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.danger },
  btnCancel: { backgroundColor: colors.surface2 },
  btnText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
});
