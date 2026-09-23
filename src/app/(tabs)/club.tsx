import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RunMap from '../../components/RunMap';
import TrackSvg from '../../components/TrackSvg';
import { Button } from '../../components/ui';
import {
  clubConfigured,
  fetchFeed,
  fetchLeaderboard,
  unpack,
  type ClubFeedItem,
  type LeaderRow,
} from '../../lib/club';
import { formatDate, formatDuration, formatKm, formatPace, formatTime, paceSecPerKm, type TrackPoint } from '../../lib/geo';
import { getSettings, type Settings } from '../../lib/storage';
import { colors, fonts } from '../../lib/theme';

type Tab = 'feed' | 'top' | 'map';
type Period = 'week' | 'month';

function Avatar({ name, mine }: { name: string; mine?: boolean }) {
  return (
    <View style={[styles.avatar, mine && { backgroundColor: colors.accent }]}>
      <Text style={[styles.avatarText, mine && { color: colors.accentText }]}>{name.trim().slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export default function ClubScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>('feed');
  const [period, setPeriod] = useState<Period>('week');
  const [feed, setFeed] = useState<ClubFeedItem[]>([]);
  const [top, setTop] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [end, setEnd] = useState(false);
  const loadingMore = useRef(false);

  const load = useCallback(async (p: Period = period) => {
    setLoading(true);
    setError(null);
    try {
      const [f, t] = await Promise.all([fetchFeed(), fetchLeaderboard(p)]);
      setFeed(f);
      setTop(t);
      setEnd(f.length < 30);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      getSettings().then((s) => {
        setSettings(s);
        if (clubConfigured() && s.clubCode) load();
      });
    }, [load]),
  );

  const more = async () => {
    if (end || loadingMore.current || feed.length === 0) return;
    loadingMore.current = true;
    try {
      const next = await fetchFeed(feed[feed.length - 1].startedAt);
      setFeed((f) => [...f, ...next]);
      if (next.length < 30) setEnd(true);
    } catch {}
    loadingMore.current = false;
  };

  const changePeriod = async (p: Period) => {
    setPeriod(p);
    try {
      setTop(await fetchLeaderboard(p));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Все маршруты недели на одной карте: каждый маршрут — свой отрезок
  const weekRoutes = useMemo(() => {
    const from = Date.now() - 7 * 86400000;
    const pts: TrackPoint[] = [];
    let seg = 0;
    for (const item of feed) {
      if (item.startedAt < from) break;
      for (const p of unpack(item.preview)) pts.push({ ...p, seg: seg * 1000 + p.seg });
      seg++;
    }
    return pts;
  }, [feed]);

  if (!settings) return <View style={styles.root} />;

  if (!clubConfigured() || !settings.clubCode) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <Text style={[styles.h1, { paddingHorizontal: 16 }]}>Клуб</Text>
        <View style={styles.empty}>
          <Ionicons name="people" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Пробежки клуба</Text>
          <Text style={styles.emptyText}>
            {clubConfigured()
              ? 'Введи код клуба в Настройках, чтобы видеть пробежки Pobeda Run и рейтинг.'
              : 'Облако клуба пока не подключено к этой версии приложения.'}
          </Text>
          {clubConfigured() && <Button title="Открыть настройки" onPress={() => router.push('/settings')} style={{ marginTop: 18 }} />}
        </View>
      </SafeAreaView>
    );
  }

  const header = (
    <View>
      <Text style={styles.h1}>Pobeda Run</Text>
      <View style={styles.tabs}>
        {(
          [
            ['feed', 'Лента'],
            ['top', 'Рейтинг'],
            ['map', 'Карта'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabActive]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {error && (
        <Pressable onPress={() => load()} style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={[styles.errorText, { fontFamily: fonts.bodyBold }]}>Нажми, чтобы повторить</Text>
        </Pressable>
      )}
    </View>
  );

  if (tab === 'map') {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={{ paddingHorizontal: 16 }}>{header}</View>
        <View style={styles.mapBox}>
          <RunMap points={weekRoutes} mode="static" mapStyle={settings.mapStyle} style={StyleSheet.absoluteFill} fitPadding={30} />
        </View>
        <Text style={styles.mapCaption}>Маршруты клуба за последние 7 дней</Text>
      </SafeAreaView>
    );
  }

  if (tab === 'top') {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <FlatList
          data={top}
          keyExtractor={(r) => String(r.place)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={colors.accent} />}
          ListHeaderComponent={
            <View>
              {header}
              <View style={[styles.tabs, { marginTop: 4, marginBottom: 8 }]}>
                {(['week', 'month'] as Period[]).map((p) => (
                  <Pressable key={p} onPress={() => changePeriod(p)} style={[styles.chip, period === p && styles.chipActive]}>
                    <Text style={[styles.chipText, period === p && styles.chipTextActive]}>{p === 'week' ? 'Эта неделя' : 'Этот месяц'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? null : <Text style={styles.emptyText}>Пока никто не бегал в этом периоде. Будь первой!</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.topRow, item.mine && styles.topRowMine]}>
              <Text style={[styles.place, item.place <= 3 && { color: colors.accent }]}>{item.place}</Text>
              <Avatar name={item.runner} mine={item.mine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.runner} numberOfLines={1}>
                  {item.runner}
                  {item.mine ? ' · ты' : ''}
                </Text>
                <Text style={styles.sub}>
                  {item.runs} {item.runs === 1 ? 'пробежка' : item.runs < 5 ? 'пробежки' : 'пробежек'} · {formatPace(paceSecPerKm(item.distanceM, item.durationMs))} /км
                </Text>
              </View>
              <Text style={styles.topKm}>{formatKm(item.distanceM, 1)}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <FlatList
        data={feed}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={colors.accent} />}
        onEndReached={more}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>В ленте пока пусто. Открой свою пробежку в Истории и нажми «В клуб».</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]} onPress={() => router.push(`/club/${item.id}`)}>
            <View style={styles.cardHead}>
              <Avatar name={item.runner} mine={item.mine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.runner}>{item.runner}</Text>
                <Text style={styles.sub}>
                  {formatDate(item.startedAt)} · {formatTime(item.startedAt)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.cardBody}>
              <View style={{ flex: 1, gap: 10 }}>
                <View>
                  <Text style={styles.bigKm}>{formatKm(item.distanceM)}</Text>
                  <Text style={styles.sub}>км</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <View>
                    <Text style={styles.stat}>{formatDuration(item.durationMs)}</Text>
                    <Text style={styles.sub}>время</Text>
                  </View>
                  <View>
                    <Text style={styles.stat}>{formatPace(paceSecPerKm(item.distanceM, item.durationMs))}</Text>
                    <Text style={styles.sub}>темп</Text>
                  </View>
                </View>
              </View>
              <View style={styles.thumb}>
                <TrackSvg points={unpack(item.preview)} width={110} height={110} strokeWidth={3} color={colors.accent} />
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  h1: { fontFamily: fonts.display, fontSize: 34, color: colors.text, textTransform: 'uppercase', marginTop: 8 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  tab: { paddingHorizontal: 16, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.text },
  tabText: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 14 },
  tabTextActive: { color: colors.bg },
  chip: { paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 13 },
  chipTextActive: { color: colors.accent },
  error: { backgroundColor: 'rgba(255,77,77,0.15)', borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { fontFamily: fonts.body, color: colors.text, fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 22, marginTop: 12 },
  emptyText: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 24, lineHeight: 20 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15, marginTop: 10 },
  cardBody: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  runner: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
  sub: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  bigKm: { fontFamily: fonts.display, color: colors.accent, fontSize: 40, lineHeight: 46 },
  stat: { fontFamily: fonts.display, color: colors.text, fontSize: 20 },
  thumb: { width: 110, height: 110, borderRadius: 14, backgroundColor: colors.bg, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14 },
  topRowMine: { backgroundColor: colors.surface },
  place: { width: 24, fontFamily: fonts.display, color: colors.muted, fontSize: 20, textAlign: 'center' },
  topKm: { fontFamily: fonts.display, color: colors.text, fontSize: 24 },
  mapBox: { flex: 1, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface },
  mapCaption: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 10 },
});
