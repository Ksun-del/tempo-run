import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NewAchievement from '../../components/NewAchievement';
import RunMap from '../../components/RunMap';
import { makeSticker } from '../../components/card/model';
import { newAchievementsFor, type AchievementState } from '../../lib/achievements';
import { setDraft } from '../../lib/cardStore';
import { say } from '../../lib/voice';
import { Button, SectionTitle } from '../../components/ui';
import { formatDate, formatDuration, formatKm, formatPace, formatTime, paceSecPerKm, speedKmh, weekdayName } from '../../lib/geo';
import { ClubError, resyncIfShared, shareRun, unshareRun, clubConfigured } from '../../lib/club';
import { deleteRun, getRun, getSettings, listRuns, updateRunTitle, type Run, type Settings } from '../../lib/storage';
import { splitRows } from '../../lib/splits';
import { colors, fonts } from '../../lib/theme';

export default function ActivityScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [clubBusy, setClubBusy] = useState(false);
  const [newAch, setNewAch] = useState<AchievementState[]>([]);

  // Сразу после финиша — проверяем новые достижения
  useEffect(() => {
    if (!fresh) return;
    (async () => {
      const s = await getSettings();
      const found = newAchievementsFor(await listRuns(), id, s.gender);
      if (!found.length) return;
      setNewAch(found);
      if (s.voiceEnabled) say(`Новое достижение! ${found[0].name}`, false);
    })().catch(() => {});
  }, [id, fresh]);

  useEffect(() => {
    getRun(id).then((r) => {
      setRun(r);
      setTitle(r?.title ?? '');
    });
    getSettings().then(setSettings);
  }, [id]);

  if (!run) return <View style={styles.root} />;

  const pace = paceSecPerKm(run.distanceM, run.durationMs);
  const rows = splitRows(run);
  const fastest = Math.min(...rows.map((r) => r.pace));
  const slowest = Math.max(...rows.map((r) => r.pace));

  const saveTitle = async () => {
    setEditing(false);
    const t = title.trim() || run.title;
    setTitle(t);
    await updateRunTitle(run.id, t);
    setRun({ ...run, title: t });
    resyncIfShared(run.id);
  };

  const shared = !!run.clubSharedAt;
  const onClub = async () => {
    if (shared) {
      Alert.alert('Убрать из ленты клуба?', 'Пробежка останется у тебя в телефоне.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Убрать',
          style: 'destructive',
          onPress: async () => {
            setClubBusy(true);
            try {
              await unshareRun(run.id);
              setRun({ ...run, clubSharedAt: null });
            } catch (e) {
              Alert.alert('Не получилось', e instanceof Error ? e.message : String(e));
            } finally {
              setClubBusy(false);
            }
          },
        },
      ]);
      return;
    }
    setClubBusy(true);
    try {
      await shareRun(run);
      setRun({ ...run, clubSharedAt: Date.now() });
      Alert.alert('Отправлено 🎉', 'Пробежка появилась в ленте клуба.');
    } catch (e) {
      const msg = e instanceof ClubError ? e.message : 'Что-то пошло не так. Попробуй ещё раз.';
      Alert.alert('Не получилось отправить', msg);
    } finally {
      setClubBusy(false);
    }
  };

  const onDelete = () =>
    Alert.alert('Удалить пробежку?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          if (run.clubSharedAt) await unshareRun(run.id).catch(() => {});
          await deleteRun(run.id);
          router.back();
        },
      },
    ]);

  const close = () => (fresh ? router.replace('/history') : router.back());

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.mapBox}>
          {settings && (
            <RunMap points={run.points} mode="static" mapStyle={settings.mapStyle} style={StyleSheet.absoluteFill} fitPadding={40} />
          )}
          <SafeAreaView edges={['top']} style={styles.mapTop} pointerEvents="box-none">
            <Pressable style={styles.roundBtn} onPress={close} hitSlop={10}>
              <Ionicons name={fresh ? 'close' : 'chevron-back'} size={24} color={colors.text} />
            </Pressable>
            <Pressable style={styles.roundBtn} onPress={onDelete} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.text} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <Text style={styles.date}>
            {weekdayName(run.startedAt)}, {formatDate(run.startedAt)} · {formatTime(run.startedAt)}
          </Text>
          {editing ? (
            <TextInput
              value={title}
              onChangeText={setTitle}
              onBlur={saveTitle}
              onSubmitEditing={saveTitle}
              autoFocus
              style={[styles.title, styles.titleInput]}
              returnKeyType="done"
            />
          ) : (
            <Pressable onPress={() => setEditing(true)} style={styles.titleRow}>
              <Text style={styles.title}>{run.title}</Text>
              <Ionicons name="pencil" size={16} color={colors.muted} />
            </Pressable>
          )}

          <Text style={styles.km}>{formatKm(run.distanceM)}</Text>
          <Text style={styles.kmLabel}>километров</Text>

          <View style={styles.grid}>
            <Cell value={formatDuration(run.durationMs)} label="Время" />
            <Cell value={formatPace(pace)} label="Ср. темп /км" />
            <Cell value={speedKmh(run.distanceM, run.durationMs).toFixed(1).replace('.', ',')} label="Ср. скорость км/ч" />
            <Cell value={`${run.elevationGainM} м`} label="Набор высоты" />
          </View>

          {rows.length > 0 && (
            <>
              <SectionTitle>Сплиты</SectionTitle>
              <View style={styles.splitHead}>
                <Text style={[styles.splitH, { width: 44 }]}>КМ</Text>
                <Text style={[styles.splitH, { width: 64 }]}>ТЕМП</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.splitH, { width: 64, textAlign: 'right' }]}>ВРЕМЯ</Text>
              </View>
              {rows.map((r, i) => {
                const span = slowest - fastest || 1;
                const w = 40 + (60 * (slowest - r.pace)) / span;
                const best = r.pace === fastest && rows.length > 1;
                return (
                  <View key={i} style={styles.splitRow}>
                    <Text style={[styles.splitKm, { width: 44 }]}>{r.km}</Text>
                    <Text style={[styles.splitPace, { width: 64 }]}>{formatPace(r.pace)}</Text>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <View style={[styles.splitBar, { width: `${w}%` }, best && { backgroundColor: colors.accent }]} />
                    </View>
                    <Text style={[styles.splitTime, { width: 64 }]}>{formatDuration(r.ms)}</Text>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      <NewAchievement
        items={newAch}
        onClose={() => setNewAch([])}
        onCard={(a) => {
          setNewAch([]);
          setDraft(run.id, (c) => ({ ...c, set: null, stickers: [...c.stickers, { ...makeSticker('badge', a.id), anchor: 'tr', x: 0.06, y: 0.2, scale: 0.8 }] }));
          router.push(`/share/${run.id}`);
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {clubConfigured() && (
            <Button
              title={shared ? 'В клубе ✓' : 'В клуб'}
              kind="secondary"
              style={{ flex: 1 }}
              onPress={onClub}
              disabled={clubBusy}
              icon={clubBusy ? <ActivityIndicator color={colors.text} /> : <Ionicons name="people" size={18} color={colors.text} />}
            />
          )}
          <Button
            title="Поделиться"
            style={{ flex: 1.3 }}
            icon={<Ionicons name="share-social" size={20} color={colors.accentText} />}
            onPress={() => router.push(`/share/${run.id}`)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellVal}>{value}</Text>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapBox: { height: 340, backgroundColor: colors.surface },
  mapTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  body: { paddingHorizontal: 18, paddingTop: 18 },
  date: { fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  title: { fontFamily: fonts.bodyBold, color: colors.text, fontSize: 22 },
  titleInput: { borderBottomWidth: 1, borderBottomColor: colors.accent, paddingVertical: 2, marginTop: 4 },
  km: { fontFamily: fonts.display, color: colors.text, fontSize: 88, lineHeight: 96, marginTop: 14 },
  kmLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, rowGap: 16 },
  cell: { width: '50%' },
  cellVal: { fontFamily: fonts.display, color: colors.text, fontSize: 28 },
  cellLabel: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  splitHead: { flexDirection: 'row', paddingBottom: 6 },
  splitH: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 11, letterSpacing: 1 },
  splitRow: { flexDirection: 'row', alignItems: 'center', height: 34 },
  splitKm: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 14 },
  splitPace: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 14 },
  splitBar: { height: 14, borderRadius: 4, backgroundColor: '#5B5B63' },
  splitTime: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'right' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(11,11,12,0.94)',
  },
});
