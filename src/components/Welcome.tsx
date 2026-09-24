import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { saveSettings, type Settings } from '../lib/storage';
import { colors, fonts } from '../lib/theme';
import { Button } from './ui';

/** Знакомство при первом запуске: имя и как обращаться */
export default function Welcome({ settings, onDone }: { settings: Settings; onDone: (s: Settings) => void }) {
  const [name, setName] = useState(settings.name);
  const [gender, setGender] = useState<Settings['gender']>(settings.gender);
  const save = async () => onDone(await saveSettings({ name: name.trim(), gender }));
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>Давай знакомиться</Text>
          <Text style={styles.label}>Как тебя зовут?</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Имя"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={30}
          />
          <Text style={styles.label}>Как к тебе обращаться?</Text>
          <View style={styles.row}>
            {(
              [
                ['f', 'Она', 'Ты пробежала 5 км'],
                ['m', 'Он', 'Ты пробежал 5 км'],
              ] as const
            ).map(([v, label, hint]) => (
              <Pressable key={v} onPress={() => setGender(v)} style={[styles.choice, gender === v && styles.choiceOn]}>
                <Text style={[styles.choiceText, gender === v && { color: colors.accentText }]}>{label}</Text>
                <Text style={[styles.choiceHint, gender === v && { color: colors.accentText }]}>{hint}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="Готово" onPress={save} disabled={!gender} style={{ marginTop: 20 }} />
          <Text style={styles.note}>Это можно поменять в Настройках.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: colors.surface, borderRadius: 28, padding: 22 },
  title: { fontFamily: fonts.display, color: colors.text, fontSize: 28, textTransform: 'uppercase' },
  label: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 13, marginTop: 18, marginBottom: 8 },
  input: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 16, backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 14, height: 50 },
  row: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderRadius: 16, backgroundColor: colors.surface2, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  choiceOn: { backgroundColor: colors.accent },
  choiceText: { fontFamily: fonts.display, color: colors.text, fontSize: 22, textTransform: 'uppercase' },
  choiceHint: { fontFamily: fonts.body, color: colors.muted, fontSize: 11, marginTop: 2 },
  note: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
