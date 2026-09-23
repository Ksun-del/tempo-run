import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RunMap, { type RunMapHandle } from '../components/RunMap';
import { Stat } from '../components/ui';
import { formatDuration, formatKm, formatPace, haversine, paceSecPerKm, type TrackPoint } from '../lib/geo';
import { useActiveRun, useNow } from '../lib/hooks';
import { getSettings, type Settings } from '../lib/storage';
import { colors, fonts } from '../lib/theme';
import { finishRun, movingTime, pauseRun, resumeRun } from '../lib/tracker';

/** Текущий темп по последним ~30 секундам текущего отрезка */
function currentPace(points: TrackPoint[], seg: number): number | null {
  const last = points[points.length - 1];
  if (!last || last.seg !== seg) return null;
  let d = 0;
  let i = points.length - 1;
  while (i > 0 && points[i - 1].seg === seg && last.t - points[i - 1].t <= 30000) {
    d += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    i--;
  }
  const dt = last.t - points[i].t;
  if (d < 20 || dt < 8000) return null;
  return dt / 1000 / (d / 1000);
}

export default function RunScreen() {
  const run = useActiveRun();
  const now = useNow(1000, !!run && run.status === 'running');
  const map = useRef<RunMapHandle>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!run && !finishing) router.back();
  }, [run, finishing]);

  const points = run?.points ?? [];
  const pts = useMemo(() => points.slice(), [points.length, run?.seg]);
  if (!run) return <View style={styles.root} />;

  const elapsed = movingTime(run, run.status === 'paused' && run.pausedAt ? run.pausedAt : now);
  const avg = paceSecPerKm(run.distanceM, elapsed);
  const cur = run.status === 'running' ? currentPace(points, run.seg) : null;
  const me = run.lastFix ? { lat: run.lastFix.lat, lon: run.lastFix.lon } : null;
  const paused = run.status === 'paused';

  const onFinish = () => {
    Alert.alert('Завершить тренировку?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setFinishing(true);
          await finishRun(false);
          router.replace('/');
        },
      },
      {
        text: 'Сохранить',
        onPress: async () => {
          setFinishing(true);
          const saved = await finishRun(true);
          if (saved) router.replace(`/activity/${saved.id}?fresh=1`);
          else {
            Alert.alert('Слишком коротко', 'Трек почти пустой, сохранять нечего.');
            router.replace('/');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        {settings && (
          <RunMap
            ref={map}
            points={pts}
            me={me}
            mode="live"
            mapStyle={settings.mapStyle}
            style={StyleSheet.absoluteFill}
          />
        )}
        <SafeAreaView edges={['top']} style={styles.mapTop} pointerEvents="box-none">
          <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <View style={[styles.gpsPill, run.lastFix?.acc != null && run.lastFix.acc <= 15 && { borderColor: colors.accent }]}>
            <Ionicons name="navigate" size={12} color={run.lastFix ? colors.accent : colors.muted} />
            <Text style={styles.gpsText}>
              {run.lastFix ? `GPS ±${Math.round(run.lastFix.acc ?? 0)} м` : 'Ищем GPS…'}
            </Text>
          </View>
          <Pressable style={styles.roundBtn} onPress={() => map.current?.recenter()} hitSlop={10}>
            <Ionicons name="locate" size={22} color={colors.text} />
          </Pressable>
        </SafeAreaView>
        {run.mode === 'foreground' && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>Фоновая запись недоступна — не блокируй экран во время бега</Text>
          </View>
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={[styles.panel, paused && styles.panelPaused]}>
        {paused && <Text style={styles.pausedLabel}>ПАУЗА</Text>}
        <Stat value={formatKm(run.distanceM)} label="километры" big />
        <View style={styles.row}>
          <Stat value={formatDuration(elapsed)} label="время" style={styles.cell} />
          <Stat value={formatPace(cur)} label="темп сейчас" style={styles.cell} />
          <Stat value={formatPace(avg)} label="ср. темп" style={styles.cell} />
        </View>

        <View style={styles.controls}>
          {paused ? (
            <>
              <Pressable style={[styles.ctrl, styles.ctrlStop]} onPress={onFinish}>
                <Ionicons name="stop" size={34} color={colors.text} />
              </Pressable>
              <Pressable style={[styles.ctrl, styles.ctrlGo]} onPress={resumeRun}>
                <Ionicons name="play" size={36} color={colors.accentText} />
              </Pressable>
            </>
          ) : (
            <Pressable style={[styles.ctrl, styles.ctrlPause]} onPress={pauseRun}>
              <Ionicons name="pause" size={38} color={colors.accentText} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { flex: 1 },
  mapTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(11,11,12,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(11,11,12,0.8)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsText: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 12 },
  warn: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,107,44,0.95)',
    borderRadius: 12,
    padding: 10,
  },
  warnText: { fontFamily: fonts.bodyMedium, color: '#fff', fontSize: 13, textAlign: 'center' },
  panel: {
    backgroundColor: colors.bg,
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  panelPaused: { backgroundColor: '#141410' },
  pausedLabel: {
    alignSelf: 'center',
    fontFamily: fonts.display,
    color: colors.accent,
    fontSize: 14,
    letterSpacing: 4,
    marginBottom: -4,
  },
  row: { flexDirection: 'row', marginTop: 14 },
  cell: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingVertical: 22 },
  ctrl: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  ctrlPause: { backgroundColor: colors.accent },
  ctrlGo: { backgroundColor: colors.accent },
  ctrlStop: { backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.danger },
});
