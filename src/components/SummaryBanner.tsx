/** В первую неделю месяца на главном экране: «Итоги сентября готовы» (и итоги года в январе) */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { RunSummary } from '../lib/storage';
import { monthGen, monthKey, parsePeriod } from '../lib/summary';
import { colors, fonts } from '../lib/theme';

const SEEN = 'tempo:summary-hidden:';

export default function SummaryBanner({ runs }: { runs: RunSummary[] }) {
  const [hidden, setHidden] = useState<boolean | null>(null);

  const target = useMemo(() => {
    const now = new Date();
    if (now.getDate() > 7) return null;
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    // в январе показываем итоги года, в остальные месяцы — прошлого месяца
    const key = now.getMonth() === 0 ? String(prevYear) : monthKey(prevYear, prevMonth);
    const p = parsePeriod(key)!;
    if (!runs.some((r) => r.startedAt >= p.from && r.startedAt < p.to)) return null;
    return { key, text: now.getMonth() === 0 ? `Твой ${prevYear} год в цифрах` : `Итоги ${monthGen(prevMonth)} готовы` };
  }, [runs]);

  useEffect(() => {
    if (!target) return;
    AsyncStorage.getItem(SEEN + target.key)
      .then((v) => setHidden(v === '1'))
      .catch(() => setHidden(false));
  }, [target?.key]);

  if (!target || hidden !== false) return null;

  const hide = () => {
    setHidden(true);
    AsyncStorage.setItem(SEEN + target.key, '1').catch(() => {});
  };

  return (
    <Pressable style={({ pressed }) => [styles.box, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/summary/${target.key}`)}>
      <Ionicons name="sparkles" size={18} color={colors.accentText} />
      <Text style={styles.text}>{target.text}</Text>
      <Text style={styles.go}>Смотреть</Text>
      <Pressable onPress={hide} hitSlop={10}>
        <Ionicons name="close" size={18} color={colors.accentText} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 14, height: 46, marginTop: 10 },
  text: { flex: 1, fontFamily: fonts.bodySemi, color: colors.accentText, fontSize: 14 },
  go: { fontFamily: fonts.bodyBold, color: colors.accentText, fontSize: 13, textDecorationLine: 'underline' },
});
