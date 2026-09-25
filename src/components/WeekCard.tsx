/** Главный экран: цель недели (кольцо) и пробег кроссовок */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatKm } from '../lib/geo';
import { shoeKm, shoeState, useShoes } from '../lib/shoes';
import { saveSettings, type RunSummary, type Settings } from '../lib/storage';
import { reloadSettings } from '../lib/tracker';
import { colors, fonts } from '../lib/theme';
import Sheet from './Sheet';

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

export function runsWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'пробежка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пробежки';
  return 'пробежек';
}

const GOALS = [10, 15, 20, 25, 30, 40, 50, 70];

function Ring({ progress, size = 58 }: { progress: number; size?: number }) {
  const sw = 7;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={sw} fill="none" />
      {p > 0 && (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </Svg>
  );
}

export default function WeekCard({ runs, settings, onSettings }: { runs: RunSummary[]; settings: Settings; onSettings: (s: Settings) => void }) {
  const shoes = useShoes();
  const [goalSheet, setGoalSheet] = useState(false);
  const [custom, setCustom] = useState('');

  const week = useMemo(() => {
    const from = startOfWeek();
    const list = runs.filter((r) => r.startedAt >= from);
    return { km: list.reduce((a, r) => a + r.distanceM, 0) / 1000, count: list.length };
  }, [runs]);

  const shoe = shoes.find((s) => s.id === settings.activeShoeId && !s.retired);
  const km = shoe ? shoeKm(shoe, runs) : 0;
  const st = shoe ? shoeState(km, shoe.limitKm) : 'ok';

  const goal = settings.weekGoalKm;
  const left = goal - week.km;
  const done = goal > 0 && left <= 0;

  const setGoal = async (v: number) => {
    setGoalSheet(false);
    const next = await saveSettings({ weekGoalKm: v });
    reloadSettings();
    onSettings(next);
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.goal} onPress={() => setGoalSheet(true)}>
        {goal > 0 ? (
          <>
            <View>
              <Ring progress={week.km / goal} />
              <View style={styles.ringCenter}>
                {done ? (
                  <Ionicons name="checkmark" size={24} color={colors.accent} />
                ) : (
                  <Text style={styles.ringPct}>{Math.floor((week.km / goal) * 100)}%</Text>
                )}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>Цель недели</Text>
              <Text style={styles.big}>
                {formatKm(week.km * 1000, 1)} <Text style={styles.of}>из {goal} км</Text>
              </Text>
              <Text style={[styles.small, done && { color: colors.accent }]} numberOfLines={2}>
                {done
                  ? `Выполнена! ${week.count} ${runsWord(week.count)} — так держать`
                  : `Осталось ${formatKm(left * 1000, 1)} км · ${week.count} ${runsWord(week.count)}`}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.weekIcon}>
              <Text style={styles.weekKm}>{formatKm(week.km * 1000, 1)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>
                км на этой неделе · {week.count} {runsWord(week.count)}
              </Text>
              <Text style={styles.setGoal}>+ Поставить цель на неделю</Text>
            </View>
          </>
        )}
      </Pressable>

      {shoe && (
        <Pressable style={styles.shoe} onPress={() => router.push('/(tabs)/settings')}>
          <Ionicons name="footsteps" size={16} color={st === 'ok' ? colors.muted : colors.accent} />
          <Text style={styles.shoeName} numberOfLines={1}>
            {shoe.name} · {Math.round(km)} км
          </Text>
          {st !== 'ok' && <Text style={styles.shoeWarn}>{st === 'worn' ? 'пора менять' : 'скоро менять'}</Text>}
        </Pressable>
      )}

      <Sheet visible={goalSheet} title="Цель на неделю" onClose={() => setGoalSheet(false)}>
        <Text style={styles.sheetText}>Сколько километров хочется пробегать за неделю? Кольцо будет заполняться с каждой пробежкой.</Text>
        <View style={styles.goals}>
          {GOALS.map((v) => (
            <Pressable key={v} onPress={() => setGoal(v)} style={[styles.goalChip, goal === v && styles.goalChipOn]}>
              <Text style={[styles.goalChipText, goal === v && { color: colors.accentText }]}>{v} км</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput
            value={custom}
            onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder="Своя цель, км"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Pressable
            onPress={() => Number(custom) > 0 && setGoal(Number(custom))}
            style={[styles.okBtn, !(Number(custom) > 0) && { opacity: 0.4 }]}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
        {goal > 0 && (
          <Pressable onPress={() => setGoal(0)} style={{ paddingVertical: 14 }}>
            <Text style={[styles.sheetText, { color: colors.danger, marginBottom: 0 }]}>Убрать цель</Text>
          </Pressable>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, backgroundColor: 'rgba(22,22,24,0.94)', borderRadius: 18, padding: 12, gap: 10 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 12 },
  small: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  big: { fontFamily: fonts.display, color: colors.accent, fontSize: 22, marginVertical: 1 },
  of: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 14 },
  weekIcon: { minWidth: 58, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekKm: { fontFamily: fonts.display, color: colors.accent, fontSize: 26 },
  setGoal: { fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 14, marginTop: 3 },
  shoe: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  shoeName: { flex: 1, fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 13 },
  shoeWarn: { fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 12 },
  sheetText: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { paddingHorizontal: 16, height: 42, borderRadius: 21, backgroundColor: colors.surface2, justifyContent: 'center' },
  goalChipOn: { backgroundColor: colors.accent },
  goalChipText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  input: { flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface2, color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 16, paddingHorizontal: 14 },
  okBtn: { width: 64, height: 46, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  okText: { fontFamily: fonts.bodyBold, color: colors.accentText, fontSize: 15 },
});
