import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, SectionTitle } from '../../components/ui';
import { checkClubCode, clubConfigured } from '../../lib/club';
import { addDemoRun } from '../../lib/demo';
import { getSettings, saveSettings, type Settings } from '../../lib/storage';
import { colors, fonts } from '../../lib/theme';
import { isBackgroundDisabled, reloadSettings, resetBackgroundMode } from '../../lib/tracker';
import { announceSplit } from '../../lib/voice';

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => (
        <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.segItem, value === o.value && styles.segActive]}>
          <Text style={[styles.segText, value === o.value && styles.segTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const [s, setS] = useState<Settings | null>(null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [bgOff, setBgOff] = useState(false);

  useEffect(() => {
    isBackgroundDisabled().then(setBgOff);
    getSettings().then((x) => {
      setS(x);
      setCode(x.clubCode);
    });
  }, []);

  const connectClub = async () => {
    const c = code.trim();
    if (!c) {
      await update({ clubCode: '' });
      Alert.alert('Готово', 'Код клуба удалён.');
      return;
    }
    setChecking(true);
    try {
      const r = await checkClubCode(c);
      await update({ clubCode: c });
      Alert.alert('Подключено 🎉', `В облаке клуба ${r.people} чел. и ${r.runs} пробежек.`);
    } catch (e) {
      Alert.alert('Не получилось подключиться', e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setS(next);
    reloadSettings();
  };

  if (!s) return <View style={styles.root} />;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Настройки</Text>

        <SectionTitle>Профиль</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.label}>Имя (для приветствия и карточек)</Text>
          <TextInput
            defaultValue={s.name}
            onChangeText={(t) => saveSettings({ name: t.trim() })}
            onEndEditing={(e) => update({ name: e.nativeEvent.text.trim() })}
            placeholder="Как тебя зовут?"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <SectionTitle>Клуб Pobeda Run</SectionTitle>
        <View style={styles.card}>
          {clubConfigured() ? (
            <>
              <Text style={styles.label}>Код клуба — его знают только участники</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Например, POBEDA2026"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Button
                title={s.clubCode && s.clubCode === code.trim() ? 'Подключено ✓' : 'Подключиться'}
                kind={s.clubCode && s.clubCode === code.trim() ? 'secondary' : 'primary'}
                style={{ marginTop: 12, height: 46 }}
                onPress={connectClub}
                disabled={checking}
              />
              <Text style={[styles.label, { marginTop: 10, marginBottom: 0 }]}>
                В клубе увидят твоё имя и пробежки, которые ты сама отправишь кнопкой «В клуб».
              </Text>
            </>
          ) : (
            <Text style={styles.tip}>Облако клуба пока не подключено к этой версии приложения.</Text>
          )}
        </View>

        <SectionTitle>Голосовые подсказки</SectionTitle>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowText}>Озвучивать тренировку</Text>
            <Switch
              value={s.voiceEnabled}
              onValueChange={(v) => update({ voiceEnabled: v })}
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor={s.voiceEnabled ? colors.bg : colors.muted}
            />
          </View>
          <Text style={[styles.label, { marginTop: 14 }]}>Как часто</Text>
          <Segmented
            value={s.voiceEveryKm}
            onChange={(v) => update({ voiceEveryKm: v })}
            options={[
              { value: 1, label: 'Каждый км' },
              { value: 2, label: '2 км' },
              { value: 5, label: '5 км' },
            ]}
          />
          <Button
            title="Проверить голос"
            kind="secondary"
            style={{ marginTop: 14, height: 44 }}
            onPress={() => announceSplit(1, 5 * 60000 + 32000, 5 * 60000 + 32000)}
          />
        </View>

        <SectionTitle>Карта</SectionTitle>
        <View style={styles.card}>
          <Segmented
            value={s.mapStyle}
            onChange={(v) => update({ mapStyle: v })}
            options={[
              { value: 'dark', label: 'Тёмная' },
              { value: 'light', label: 'Светлая' },
            ]}
          />
        </View>

        {bgOff && (
          <>
            <SectionTitle>Фоновая запись</SectionTitle>
            <View style={styles.card}>
              <Text style={styles.tip}>
                Фоновая запись GPS выключена: в прошлый раз она привела к сбою. Сейчас трек пишется, только пока экран включён
                (приложение само не даёт ему погаснуть).
              </Text>
              <Button
                title="Попробовать фоновую запись снова"
                kind="secondary"
                style={{ marginTop: 12, height: 46 }}
                onPress={async () => {
                  await resetBackgroundMode();
                  setBgOff(false);
                  Alert.alert('Готово', 'В следующей тренировке попробуем писать трек в фоне.');
                }}
              />
            </View>
          </>
        )}

        <SectionTitle>Как не потерять трек</SectionTitle>
        <View style={styles.card}>
          <Text style={styles.tip}>
            • Во время бега в шторке висит уведомление «Идёт тренировка» — это нормально, так Android не отключает GPS.{'\n'}
            • Если трек обрывается при заблокированном экране: Настройки телефона → Приложения → RUN → Батарея → «Без ограничений».{'\n'}
            • Перед стартом подожди, пока точность GPS станет меньше 15 м.
          </Text>
        </View>

        <SectionTitle>Попробовать без пробежки</SectionTitle>
        <Button
          title="Добавить демо-пробежку"
          kind="ghost"
          onPress={async () => {
            await addDemoRun();
            Alert.alert('Готово', 'Демо-пробежка появилась в Истории — можно сделать из неё карточку.');
          }}
        />

        <Text style={styles.footer}>RUN 1.1 · карты © OpenFreeMap, © OpenStreetMap</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  h1: { fontFamily: fonts.display, fontSize: 34, color: colors.text, textTransform: 'uppercase', marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  label: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginBottom: 8 },
  input: {
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 15 },
  seg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 12, padding: 3 },
  segItem: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.accent },
  segText: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 14 },
  segTextActive: { color: colors.accentText },
  tip: { fontFamily: fonts.body, color: colors.text, fontSize: 14, lineHeight: 21 },
  footer: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 28 },
});
