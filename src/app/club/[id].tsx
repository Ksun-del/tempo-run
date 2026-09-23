import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RunMap from '../../components/RunMap';
import { SectionTitle } from '../../components/ui';
import { fetchClubRun, unpack, type ClubRun } from '../../lib/club';
import { formatDate, formatDuration, formatKm, formatPace, formatTime, paceSecPerKm, speedKmh, weekdayName } from '../../lib/geo';
import { splitRows } from '../../lib/splits';
import { getSettings, type Run, type Settings } from '../../lib/storage';
import { colors, fonts } from '../../lib/theme';

export default function ClubRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [run, setRun] = useState<ClubRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    fetchClubRun(id)
      .then(setRun)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  const back = (
    <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
      <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
    </SafeAreaView>
  );

  if (!run) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        {error ? <Text style={styles.sub}>{error}</Text> : <ActivityIndicator color={colors.accent} />}
        {back}
      </View>
    );
  }

  const points = unpack(run.track);
  const asRun: Run = {
    id: run.id,
    title: run.title,
    startedAt: run.startedAt,
    endedAt: run.startedAt + run.durationMs,
    durationMs: run.durationMs,
    distanceM: run.distanceM,
    elevationGainM: run.elevationGainM,
    splits: run.splits,
    points,
  };
  const rows = splitRows(asRun);
  const fastest = Math.min(...rows.map((r) => r.pace));
  const slowest = Math.max(...rows.map((r) => r.pace));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.mapBox}>
          {settings && <RunMap points={points} mode="static" mapStyle={settings.mapStyle} style={StyleSheet.absoluteFill} fitPadding={40} />}
          {back}
        </View>
        <View style={styles.body}>
          <Text style={styles.runner}>{run.runner}</Text>
          <Text style={styles.sub}>
            {weekdayName(run.startedAt)}, {formatDate(run.startedAt)} · {formatTime(run.startedAt)}
          </Text>
          <Text style={styles.title}>{run.title}</Text>
          <Text style={styles.km}>{formatKm(run.distanceM)}</Text>
          <Text style={styles.sub}>километров</Text>
          <View style={styles.grid}>
            <Cell value={formatDuration(run.durationMs)} label="Время" />
            <Cell value={formatPace(paceSecPerKm(run.distanceM, run.durationMs))} label="Ср. темп /км" />
            <Cell value={speedKmh(run.distanceM, run.durationMs).toFixed(1).replace('.', ',')} label="Ср. скорость км/ч" />
            <Cell value={`${run.elevationGainM} м`} label="Набор высоты" />
          </View>
          {rows.length > 0 && (
            <>
              <SectionTitle>Сплиты</SectionTitle>
              {rows.map((r, i) => {
                const span = slowest - fastest || 1;
                const w = 40 + (60 * (slowest - r.pace)) / span;
                const best = r.pace === fastest && rows.length > 1;
                return (
                  <View key={i} style={styles.splitRow}>
                    <Text style={[styles.splitText, { width: 44 }]}>{r.km}</Text>
                    <Text style={[styles.splitText, { width: 64 }]}>{formatPace(r.pace)}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.splitBar, { width: `${w}%` }, best && { backgroundColor: colors.accent }]} />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ width: '50%' }}>
      <Text style={styles.cellVal}>{value}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(11,11,12,0.8)', alignItems: 'center', justifyContent: 'center' },
  mapBox: { height: 360, backgroundColor: colors.surface },
  body: { paddingHorizontal: 18, paddingTop: 18 },
  runner: { fontFamily: fonts.bodyBold, color: colors.accent, fontSize: 16 },
  title: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 22, marginTop: 6 },
  sub: { fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  km: { fontFamily: fonts.display, color: colors.text, fontSize: 80, lineHeight: 90, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, rowGap: 16 },
  cellVal: { fontFamily: fonts.display, color: colors.text, fontSize: 28 },
  splitRow: { flexDirection: 'row', alignItems: 'center', height: 32 },
  splitText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 14 },
  splitBar: { height: 14, borderRadius: 4, backgroundColor: '#5B5B63' },
});
