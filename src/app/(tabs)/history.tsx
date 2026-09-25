import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Badge from '../../components/Badge';
import Sheet, { SheetOption } from '../../components/Sheet';
import TrackSvg from '../../components/TrackSvg';
import { computeAchievements, type AchievementState } from '../../lib/achievements';
import { formatDate, formatShortDate, formatDuration, formatKm, formatPace, formatTime, paceSecPerKm } from '../../lib/geo';
import { healthSupported, importHealthRun, listHealthRuns, openHealthSettings, type HealthRun } from '../../lib/health';
import { useRuns, useSettings } from '../../lib/hooks';
import { importGpxFile } from '../../lib/importRun';
import type { RunSummary } from '../../lib/storage';
import { colors, fonts } from '../../lib/theme';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

type Period = 'week' | 'month' | 'year' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'year', label: 'Год' },
  { key: 'all', label: 'Всё время' },
];

function periodStart(p: Period): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (p === 'month') d.setDate(1);
  else if (p === 'year') d.setMonth(0, 1);
  else return 0;
  return d.getTime();
}

/** Километры по дням текущей недели / месяца — для мини-графика */
function bars(runs: RunSummary[], p: Period): { label: string; km: number }[] {
  if (p === 'week') {
    const start = periodStart('week');
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return labels.map((label, i) => ({
      label,
      km:
        runs
          .filter((r) => r.startedAt >= start + i * 86400000 && r.startedAt < start + (i + 1) * 86400000)
          .reduce((a, r) => a + r.distanceM, 0) / 1000,
    }));
  }
  if (p === 'year' || p === 'all') {
    const y = new Date().getFullYear();
    return MONTHS.map((m, i) => ({
      label: m.slice(0, 1),
      km:
        runs
          .filter((r) => {
            const d = new Date(r.startedAt);
            return d.getFullYear() === y && d.getMonth() === i;
          })
          .reduce((a, r) => a + r.distanceM, 0) / 1000,
    }));
  }
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const start = periodStart('month');
  return Array.from({ length: days }, (_, i) => ({
    label: i % 5 === 0 ? String(i + 1) : '',
    km:
      runs
        .filter((r) => r.startedAt >= start + i * 86400000 && r.startedAt < start + (i + 1) * 86400000)
        .reduce((a, r) => a + r.distanceM, 0) / 1000,
  }));
}

function runsWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'пробежка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пробежки';
  return 'пробежек';
}

export default function HistoryScreen() {
  const { runs, loading } = useRuns();
  const [period, setPeriod] = useState<Period>('week');
  const settings = useSettings();
  const achievements = useMemo(() => computeAchievements(runs, settings?.gender ?? 'f'), [runs, settings?.gender]);
  const earnedCount = achievements.filter((a) => a.earnedAt != null).length;
  const [openAch, setOpenAch] = useState<AchievementState | null>(null);
  const [achOpen, setAchOpen] = useState(false);
  // в свёрнутом виде: последние полученные, а если их мало — ближайшие цели
  const achPreview = useMemo(() => {
    const got = achievements.filter((a) => a.earnedAt != null).sort((x, y) => (y.earnedAt ?? 0) - (x.earnedAt ?? 0));
    const next = achievements.filter((a) => a.earnedAt == null && !a.secret).sort((x, y) => y.progress - x.progress);
    return [...got, ...next].slice(0, 5);
  }, [achievements]);
  const [addSheet, setAddSheet] = useState(false);
  const [hcSheet, setHcSheet] = useState(false);
  const [hcRuns, setHcRuns] = useState<HealthRun[] | null>(null);
  const [hcBusy, setHcBusy] = useState<string | null>(null);

  const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const fromFile = async () => {
    setAddSheet(false);
    try {
      const id = await importGpxFile();
      if (id) router.push(`/activity/${id}?fresh=1`);
    } catch (e) {
      Alert.alert('Не получилось добавить', errText(e));
    }
  };

  const fromHealth = async () => {
    setAddSheet(false);
    setHcRuns(null);
    setHcSheet(true);
    try {
      setHcRuns(await listHealthRuns(60));
    } catch (e) {
      setHcSheet(false);
      Alert.alert('Health Connect', errText(e), [
        { text: 'Открыть Health Connect', onPress: openHealthSettings },
        { text: 'Закрыть', style: 'cancel' },
      ]);
    }
  };

  const addHealthRun = async (h: HealthRun) => {
    setHcBusy(h.id);
    try {
      const id = await importHealthRun(h);
      setHcRuns((list) => list?.map((x) => (x.id === h.id ? { ...x, imported: true } : x)) ?? null);
      if (id) {
        setHcSheet(false);
        router.push(`/activity/${id}?fresh=1`);
      }
    } catch (e) {
      Alert.alert('Не получилось добавить', errText(e));
    } finally {
      setHcBusy(null);
    }
  };

  const stats = useMemo(() => {
    const from = periodStart(period);
    const list = runs.filter((r) => r.startedAt >= from);
    const dist = list.reduce((a, r) => a + r.distanceM, 0);
    const time = list.reduce((a, r) => a + r.durationMs, 0);
    return { dist, time, count: list.length, pace: paceSecPerKm(dist, time), bars: bars(runs, period) };
  }, [runs, period]);

  const sections = useMemo(() => {
    const map = new Map<string, RunSummary[]>();
    for (const r of runs) {
      const d = new Date(r.startedAt);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].map(([title, data]) => ({
      title,
      km: data.reduce((a, r) => a + r.distanceM, 0),
      data,
    }));
  }, [runs]);

  // Рекорды за всё время
  const records = useMemo(() => {
    let km1: number | null = null, km5: number | null = null, km10: number | null = null, longest = 0, total = 0;
    for (const r of runs) {
      total += r.distanceM;
      longest = Math.max(longest, r.distanceM);
      r.splits.forEach((at, i) => {
        const ms = at - (r.splits[i - 1] ?? 0);
        if (ms > 60000 && (km1 == null || ms < km1)) km1 = ms;
      });
      if (r.splits.length >= 5 && (km5 == null || r.splits[4] < km5)) km5 = r.splits[4];
      if (r.splits.length >= 10 && (km10 == null || r.splits[9] < km10)) km10 = r.splits[9];
    }
    return { km1, km5, km10, longest, total, count: runs.length };
  }, [runs]);

  const maxBar = Math.max(1, ...stats.bars.map((b) => b.km));

  const header = (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.h1}>Статистика</Text>
        <View style={styles.titleBtns}>
          {healthSupported && (
            <Pressable onPress={fromHealth} style={({ pressed }) => [styles.watchBtn, pressed && { opacity: 0.7 }]} hitSlop={8} accessibilityLabel="Пробежки с часов">
              <Ionicons name="watch-outline" size={20} color={colors.accent} />
            </Pressable>
          )}
          <Pressable onPress={() => setAddSheet(true)} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]} hitSlop={8}>
            <Ionicons name="add" size={18} color={colors.accentText} />
            <Text style={styles.addText}>Добавить</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.tabs}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[styles.tab, period === p.key && styles.tabActive]}>
            <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.summary}>
        <Text style={styles.bigKm}>{formatKm(stats.dist, 1)}</Text>
        <Text style={styles.bigKmLabel}>километров</Text>
        <View style={styles.sumRow}>
          <View style={styles.sumCell}>
            <Text style={styles.sumVal}>{stats.count}</Text>
            <Text style={styles.sumLabel}>{runsWord(stats.count)}</Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumVal}>{formatDuration(stats.time)}</Text>
            <Text style={styles.sumLabel}>время</Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumVal}>{formatPace(stats.pace)}</Text>
            <Text style={styles.sumLabel}>ср. темп</Text>
          </View>
        </View>
        <View style={styles.chart}>
          {stats.bars.map((b, i) => (
            <View key={i} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(b.km > 0 ? 6 : 0, (b.km / maxBar) * 100)}%` }]} />
              </View>
              <Text style={styles.barLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
      </View>
      {runs.length > 0 && (
        <>
          <Text style={styles.blockTitle}>Рекорды</Text>
          <View style={styles.records}>
            <Record label="Быстрый км" value={records.km1 != null ? formatDuration(records.km1) : '—'} />
            <Record label="5 км" value={records.km5 != null ? formatDuration(records.km5) : '—'} />
            <Record label="10 км" value={records.km10 != null ? formatDuration(records.km10) : '—'} />
            <Record label="Самая длинная" value={`${formatKm(records.longest, 1)} км`} />
            <Record label="Всего" value={`${formatKm(records.total, 0)} км`} />
            <Record label="Пробежек" value={String(records.count)} />
          </View>
        </>
      )}
      <>
          <Pressable style={styles.achHead} onPress={() => setAchOpen((v) => !v)} hitSlop={6}>
            <Text style={styles.blockTitle}>Достижения</Text>
            <View style={styles.achToggle}>
              <Text style={styles.achCount}>
                {earnedCount} из {achievements.length}
              </Text>
              <Ionicons name={achOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </View>
          </Pressable>
          {achOpen ? (
            <View style={styles.achGrid}>
              {achievements.map((a) => {
                const got = a.earnedAt != null;
                return (
                  <Pressable key={a.id} style={styles.achItem} onPress={() => setOpenAch(a)}>
                    <Badge a={a} size={64} locked={!got} />
                    <Text style={[styles.achName, got && { color: colors.text }]} numberOfLines={2}>
                      {!got && a.secret ? 'Секрет' : a.name}
                    </Text>
                    {a.repeat && a.count > 1 && <Text style={styles.achTimes}>×{a.count}</Text>}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable style={styles.achStrip} onPress={() => setAchOpen(true)}>
              {achPreview.map((a) => (
                <Badge key={a.id} a={a} size={48} locked={a.earnedAt == null} />
              ))}
              <Text style={styles.achMore}>Все</Text>
            </Pressable>
          )}
          {runs.length > 0 && <Text style={styles.blockTitle}>Все пробежки</Text>}
      </>
      {!loading && runs.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Пока пусто</Text>
          <Text style={styles.emptyText}>Здесь появятся твои пробежки. Нажми «Старт» на главном экране.</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionKm}>{formatKm(section.km, 1)} км</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]} onPress={() => router.push(`/activity/${item.id}`)}>
            <View style={styles.thumb}>
              <TrackSvg points={item.preview ?? []} width={64} height={64} strokeWidth={2.5} dots={false} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemDate}>
                {formatDate(item.startedAt)} · {formatTime(item.startedAt)}
              </Text>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.itemStats}>
                <Text style={styles.itemKm}>{formatKm(item.distanceM)} км</Text>
                <Text style={styles.itemSub}>{formatDuration(item.durationMs)}</Text>
                <Text style={styles.itemSub}>{formatPace(paceSecPerKm(item.distanceM, item.durationMs))} /км</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
      <Sheet visible={addSheet} title="Добавить пробежку" onClose={() => setAddSheet(false)}>
        {healthSupported && (
          <SheetOption
            icon={<Ionicons name="watch-outline" size={22} color={colors.accent} />}
            label="С часов (Health Connect)"
            onPress={fromHealth}
          />
        )}
        <SheetOption icon={<Ionicons name="document-outline" size={22} color={colors.accent} />} label="Из файла GPX" onPress={fromFile} />
        <Text style={styles.addNote}>
          {healthSupported
            ? 'Health Connect — это хранилище тренировок в телефоне. Часы Xiaomi (через Mi Fitness), Amazfit, Samsung и другие отправляют туда пробежки. GPX-файл можно выгрузить из Strava или приложения часов.'
            : 'GPX-файл можно выгрузить из Strava, приложения «Здоровье» или приложения часов.'}
        </Text>
      </Sheet>

      <Sheet visible={hcSheet} title="Пробежки с часов" onClose={() => setHcSheet(false)}>
        {!hcRuns ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} />
        ) : hcRuns.length === 0 ? (
          <Text style={styles.addNote}>
            За последние 2 месяца в Health Connect нет пробежек. Проверь, что в приложении часов (например, Mi Fitness) включена отправка тренировок в Health Connect.
          </Text>
        ) : (
          hcRuns.map((h) => (
            <View key={h.id} style={styles.hcRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hcTitle}>
                  {formatDate(h.startedAt)} · {formatTime(h.startedAt)}
                </Text>
                <Text style={styles.hcSub}>
                  {h.distanceM > 0 ? `${formatKm(h.distanceM)} км · ` : ''}
                  {formatDuration(h.endedAt - h.startedAt)} · {h.source}
                  {h.hasRoute ? ' · есть маршрут' : ''}
                </Text>
              </View>
              {h.imported ? (
                <Text style={styles.hcDone}>Добавлено</Text>
              ) : (
                <Pressable onPress={() => addHealthRun(h)} disabled={!!hcBusy} style={({ pressed }) => [styles.hcAdd, pressed && { opacity: 0.7 }]}>
                  {hcBusy === h.id ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.hcAddText}>Добавить</Text>}
                </Pressable>
              )}
            </View>
          ))
        )}
      </Sheet>

      <Sheet visible={!!openAch} title={openAch && (openAch.earnedAt != null || !openAch.secret) ? openAch.name : 'Секретное достижение'} onClose={() => setOpenAch(null)}>
        {openAch && (
          <View style={{ alignItems: 'center', paddingBottom: 16 }}>
            <Badge a={openAch} size={140} locked={openAch.earnedAt == null} />
            <Text style={styles.achDesc}>{openAch.earnedAt == null && openAch.secret ? 'Узнаешь, когда получишь' : openAch.desc}</Text>
            {openAch.earnedAt != null ? (
              <Text style={styles.achWhen}>
                Получено {formatShortDate(openAch.earnedAt)}
                {openAch.repeat && openAch.count > 1 ? ` · ${openAch.count} раз` : ''}
              </Text>
            ) : openAch.progressText ? (
              <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
                <Text style={styles.achWhen}>{openAch.progressText}</Text>
                <View style={styles.progTrack}>
                  <View style={[styles.progBar, { width: `${Math.round(openAch.progress * 100)}%` }]} />
                </View>
              </View>
            ) : (
              <Text style={styles.achWhen}>Ещё впереди</Text>
            )}
            {openAch.repeat && (
              <Text style={styles.achWhen}>{openAch.id === 'winter' ? 'Каждая новая зима добавит ×2, ×3 на значке' : 'Каждая такая пробежка добавит ×2, ×3 на значке'}</Text>
            )}
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.record}>
      <Text style={styles.recordVal}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  watchBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.accent, marginTop: 8 },
  addText: { fontFamily: fonts.bodySemi, color: colors.accentText, fontSize: 13 },
  addNote: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 8 },
  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  hcTitle: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
  hcSub: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 2 },
  hcAdd: { height: 34, minWidth: 96, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  hcAddText: { fontFamily: fonts.bodySemi, color: colors.accentText, fontSize: 13 },
  hcDone: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 13 },
  achHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  achToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 26 },
  achStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 10 },
  achMore: { flex: 1, textAlign: 'right', fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 13, paddingRight: 6 },
  achCount: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 14 },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 14 },
  achItem: { width: '33.33%', alignItems: 'center', paddingHorizontal: 4 },
  achName: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 14 },
  achTimes: { fontFamily: fonts.bodyBold, color: colors.accent, fontSize: 11 },
  achDesc: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 16, textAlign: 'center', marginTop: 14 },
  achWhen: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6 },
  progTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface2, marginTop: 8, overflow: 'hidden' },
  progBar: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  blockTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 22, textTransform: 'uppercase', marginTop: 26 },
  records: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  record: { width: '31.8%', backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10 },
  recordVal: { fontFamily: fonts.display, color: colors.accent, fontSize: 20 },
  recordLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 11, marginTop: 2 },
  root: { flex: 1, backgroundColor: colors.bg },
  h1: { fontFamily: fonts.display, fontSize: 34, color: colors.text, textTransform: 'uppercase', marginTop: 8 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tab: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.text },
  tabText: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 13 },
  tabTextActive: { color: colors.bg },
  summary: { marginTop: 18, backgroundColor: colors.surface, borderRadius: 20, padding: 18 },
  bigKm: { fontFamily: fonts.display, fontSize: 64, color: colors.text, lineHeight: 70 },
  bigKmLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 13, marginTop: 4 },
  sumRow: { flexDirection: 'row', marginTop: 16 },
  sumCell: { flex: 1 },
  sumVal: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  sumLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  chart: { flexDirection: 'row', height: 90, marginTop: 18, gap: 3, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  barLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 10, marginTop: 4, height: 13 },
  empty: { marginTop: 40, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 22 },
  emptyText: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26, marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 16 },
  sectionKm: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 14 },
  item: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' },
  itemDate: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  itemTitle: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15, marginTop: 2 },
  itemStats: { flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'baseline' },
  itemKm: { fontFamily: fonts.display, color: colors.accent, fontSize: 18 },
  itemSub: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 13 },
});
