import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SummaryCard from '../../components/SummaryCard';
import { saveCard, shareCard, webShareHint } from '../../lib/cardExport';
import { useRuns, useSettings } from '../../lib/hooks';
import { availablePeriods, computeSummary, MONTHS, parsePeriod } from '../../lib/summary';
import { colors, fonts } from '../../lib/theme';

const RATIO = 16 / 9;

export default function SummaryScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const [cur, setCur] = useState(key);
  const { runs, loading } = useRuns();
  const settings = useSettings();
  const { width: sw, height: sh } = useWindowDimensions();
  const card = useRef<View>(null);
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);

  const period = parsePeriod(cur);
  const summary = useMemo(() => (period ? computeSummary(runs, period, settings?.gender || 'f') : null), [runs, cur, settings?.gender]);
  const periods = useMemo(() => availablePeriods(runs), [runs]);
  const chips = [...periods.years, ...periods.months];

  const cardW = Math.min(sw - 48, (sh * 0.6) / RATIO);

  const onSave = async () => {
    if (!card.current) return;
    setBusy('save');
    try {
      const r = await saveCard(card.current, RATIO);
      if (r === 'denied') Alert.alert('Нет доступа к галерее', 'Разреши сохранение фото в настройках телефона.');
      else if (Platform.OS !== 'web') Alert.alert('Готово', 'Картинка сохранена в галерею.');
    } catch (e) {
      Alert.alert('Не получилось сохранить', String(e));
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    if (!card.current) return;
    setBusy('share');
    try {
      const r = await shareCard(card.current, RATIO);
      if (r === 'unavailable') Alert.alert('Поделиться нельзя', 'На этом устройстве недоступно меню «Поделиться».');
    } catch (e) {
      Alert.alert('Не получилось поделиться', String(e));
    } finally {
      setBusy(null);
    }
  };

  const chipLabel = (k: string) => {
    const p = parsePeriod(k)!;
    if (p.month == null) return `Мой ${p.year}`;
    const name = MONTHS[p.month];
    return `${name[0].toUpperCase()}${name.slice(1)}${p.year !== new Date().getFullYear() ? ` ${p.year}` : ''}`;
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 40 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.hTitle}>Итоги</Text>
        <View style={{ width: 40 }} />
      </View>

      {chips.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
          {chips.map((c) => (
            <Pressable key={c} onPress={() => setCur(c)} style={[styles.chip, c === cur && styles.chipOn]}>
              <Text style={[styles.chipText, c === cur && { color: colors.accentText }]}>{chipLabel(c)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {loading || !settings ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        ) : !summary || summary.runs === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Здесь пока пусто</Text>
            <Text style={styles.emptyText}>В этом периоде нет пробежек. Итоги появятся после первой.</Text>
          </View>
        ) : (
          <>
            <View style={styles.preview}>
              <View style={[styles.shadow, { width: cardW, height: cardW * RATIO }]}>
                <View ref={card} collapsable={false}>
                  <SummaryCard s={summary} width={cardW} name={settings.name} gender={settings.gender || 'f'} />
                </View>
              </View>
            </View>
            <View style={styles.btns}>
              <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onSave} disabled={!!busy}>
                {busy === 'save' ? <ActivityIndicator color={colors.text} /> : <Ionicons name="download-outline" size={20} color={colors.text} />}
                <Text style={styles.btnText}>Сохранить</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onShare} disabled={!!busy}>
                {busy === 'share' ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="share-social" size={20} color={colors.accentText} />}
                <Text style={[styles.btnText, { color: colors.accentText }]}>Поделиться</Text>
              </Pressable>
            </View>
            {Platform.OS === 'web' && !!webShareHint && <Text style={styles.hint}>{webShareHint}</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  hTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.display, color: colors.text, fontSize: 20, textTransform: 'uppercase' },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.accent },
  chipText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 14 },
  preview: { alignItems: 'center', paddingTop: 10 },
  shadow: { borderRadius: 18, overflow: 'hidden', elevation: 10, backgroundColor: '#000' },
  btns: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  btn: { flex: 1, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPrimary: { backgroundColor: colors.accent },
  btnSecondary: { backgroundColor: colors.surface2 },
  btnText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 16 },
  hint: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10, paddingHorizontal: 24 },
  empty: { alignItems: 'center', paddingHorizontal: 32, marginTop: 80 },
  emptyTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 24, textTransform: 'uppercase' },
  emptyText: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
