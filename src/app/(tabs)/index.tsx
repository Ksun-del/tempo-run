import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RunMap from '../../components/RunMap';
import Welcome from '../../components/Welcome';
import { g } from '../../lib/gender';
import { formatKm } from '../../lib/geo';
import { useActiveRun, useRuns } from '../../lib/hooks';
import { getSettings, type Settings } from '../../lib/storage';
import { colors, fonts } from '../../lib/theme';
import { takeLastCrash } from '../../lib/crash';
import { PermissionError, startRun } from '../../lib/tracker';

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // понедельник = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.getTime();
}

export default function HomeScreen() {
  const active = useActiveRun();
  const { runs } = useRuns();
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [starting, setStarting] = useState(false);

  // Пока экран открыт — показываем, где мы, чтобы GPS «прогрелся» до старта
  useFocusEffect(
    useCallback(() => {
      let sub: Location.LocationSubscription | null = null;
      let alive = true;
      getSettings().then((s) => alive && setSettings(s));
      takeLastCrash().then((c) => {
        if (c && alive) Alert.alert('Приложение закрылось с ошибкой', `Пришли скриншот этого окна Claude:\n\n${c.text}`);
      });
      (async () => {
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          if (!perm.granted) return;
          const last = await Location.getLastKnownPositionAsync();
          if (last && alive) setMe({ lat: last.coords.latitude, lon: last.coords.longitude });
          sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
            (l) => alive && setMe({ lat: l.coords.latitude, lon: l.coords.longitude }),
          );
        } catch {}
      })();
      return () => {
        alive = false;
        sub?.remove();
      };
    }, []),
  );

  const week = useMemo(() => {
    const from = startOfWeek();
    const list = runs.filter((r) => r.startedAt >= from);
    return { km: list.reduce((a, r) => a + r.distanceM, 0), count: list.length };
  }, [runs]);

  const onStart = async () => {
    if (active) {
      router.push('/run');
      return;
    }
    setStarting(true);
    try {
      await startRun();
      router.push('/run');
    } catch (e) {
      const msg = e instanceof PermissionError ? e.message : 'Не получилось запустить GPS. Попробуй ещё раз.';
      Alert.alert('Нет геолокации', msg);
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.root}>
      {settings && (
        <RunMap
          points={[]}
          me={me}
          mode="live"
          mapStyle={settings.mapStyle}
          interactive
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.topShade} pointerEvents="none" />
      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
        <Text style={styles.hello}>{settings?.name ? `Привет, ${settings.name}` : g(settings?.gender ?? '', 'Готова к пробежке?', 'Готов к пробежке?')}</Text>
        <View style={styles.weekRow}>
          <Text style={styles.weekKm}>{formatKm(week.km, 1)}</Text>
          <Text style={styles.weekLabel}>км на этой неделе · {week.count} {week.count === 1 ? 'пробежка' : week.count >= 2 && week.count <= 4 ? 'пробежки' : 'пробежек'}</Text>
        </View>
        {!me && (
          <View style={styles.gps}>
            <Ionicons name="locate" size={14} color={colors.muted} />
            <Text style={styles.gpsText}>Ищем GPS… Лучше стартовать на открытом месте</Text>
          </View>
        )}
      </SafeAreaView>

      <View style={styles.bottom} pointerEvents="box-none">
        <Pressable
          onPress={onStart}
          disabled={starting}
          style={({ pressed }) => [styles.startBtn, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          {starting ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.startText}>{active ? 'ИДЁТ\nБЕГ' : 'СТАРТ'}</Text>
          )}
        </Pressable>
      </View>
      {settings && !settings.gender && <Welcome settings={settings} onDone={setSettings} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, backgroundColor: 'rgba(11,11,12,0.72)' },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  hello: { fontFamily: fonts.display, color: colors.text, fontSize: 30, textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  weekKm: { fontFamily: fonts.display, color: colors.accent, fontSize: 26 },
  weekLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  gps: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 },
  gpsText: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' },
  startBtn: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: 'rgba(11,11,12,0.6)',
    elevation: 8,
  },
  startText: { fontFamily: fonts.display, fontSize: 30, color: colors.accentText, textAlign: 'center', lineHeight: 32 },
});
