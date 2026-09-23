import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { ACCENTS, LOGOS, renderTemplate, TEMPLATES, type CardData, type LogoId, type TemplateId } from '../../components/templates';
import { Button } from '../../components/ui';
import { paceSecPerKm } from '../../lib/geo';
import { splitRows } from '../../lib/splits';
import { getRun, getSettings, type Run } from '../../lib/storage';
import { colors, fonts } from '../../lib/theme';

type Format = 'story' | 'post';
const RATIO: Record<Format, number> = { story: 16 / 9, post: 5 / 4 };

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: sw, height: sh } = useWindowDimensions();
  const [run, setRun] = useState<Run | null>(null);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>('minimal');
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [format, setFormat] = useState<Format>('story');
  const [logo, setLogo] = useState<LogoId>('emblem');
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);
  const card = useRef<View>(null);

  useEffect(() => {
    getRun(id).then(setRun);
    getSettings().then((s) => setName(s.name));
  }, [id]);

  const data: CardData | null = useMemo(
    () =>
      run && {
        title: run.title,
        startedAt: run.startedAt,
        distanceM: run.distanceM,
        durationMs: run.durationMs,
        pace: paceSecPerKm(run.distanceM, run.durationMs),
        elevationGainM: run.elevationGainM,
        points: run.points,
        splits: splitRows(run),
        name,
      },
    [run, name],
  );

  // Превью помещается в экран: примерно половина высоты под карточку
  const ratio = RATIO[format];
  const maxH = sh * 0.5;
  const cardW = Math.min(sw - 48, maxH / ratio);
  const cardH = cardW * ratio;

  const pick = async (source: 'camera' | 'library') => {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: format === 'story' ? [9, 16] : [4, 5],
      quality: 0.9,
    };
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Нет доступа к камере', 'Разреши доступ к камере в настройках телефона.');
          return;
        }
      }
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
    } catch (e) {
      Alert.alert('Не получилось открыть', String(e));
    }
  };

  const capture = () =>
    captureRef(card, {
      format: 'jpg',
      quality: 0.95,
      width: 1080,
      height: Math.round(1080 * ratio),
      result: 'tmpfile',
    });

  const onSave = async () => {
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!perm.granted) {
        Alert.alert('Нет доступа к галерее', 'Разреши сохранение фото в настройках телефона.');
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Готово', 'Карточка сохранена в галерею.');
    } catch (e) {
      Alert.alert('Не получилось сохранить', String(e));
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    setBusy('share');
    try {
      const uri = await capture();
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Поделиться нельзя', 'На этом устройстве недоступно меню «Поделиться».');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Поделиться тренировкой' });
    } catch (e) {
      Alert.alert('Не получилось поделиться', String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <View style={styles.root} />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.hBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.hTitle}>Карточка</Text>
        <View style={styles.formatToggle}>
          {(['story', 'post'] as Format[]).map((f) => (
            <Pressable key={f} onPress={() => setFormat(f)} style={[styles.fBtn, format === f && styles.fBtnActive]}>
              <Text style={[styles.fText, format === f && styles.fTextActive]}>{f === 'story' ? '9:16' : '4:5'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.previewArea}>
        <View style={[styles.cardShadow, { width: cardW, height: cardH }]}>
          <View ref={card} collapsable={false} style={{ width: cardW, height: cardH, borderRadius: 0, overflow: 'hidden' }}>
            {renderTemplate(template, { data, photo, accent, width: cardW, height: cardH, logo })}
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.photoRow}>
          <PhotoBtn icon="camera" label="Камера" onPress={() => pick('camera')} />
          <PhotoBtn icon="images" label="Галерея" onPress={() => pick('library')} />
          <PhotoBtn icon="close-circle" label="Без фото" onPress={() => setPhoto(null)} active={!photo} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TEMPLATES.map((t) => (
            <Pressable key={t.id} onPress={() => setTemplate(t.id)} style={[styles.chip, template === t.id && styles.chipActive]}>
              <Text style={[styles.chipText, template === t.id && styles.chipTextActive]}>{t.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.logoRow}>
          {(['emblem', 'wordmark', 'none'] as LogoId[]).map((l) => (
            <Pressable key={l} onPress={() => setLogo(l)} style={[styles.logoChip, logo === l && styles.chipActive]}>
              <Text style={[styles.logoChipText, logo === l && styles.chipTextActive]}>{l === 'none' ? 'Без логотипа' : LOGOS[l].label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.swatches}>
          {ACCENTS.map((c) => (
            <Pressable key={c} onPress={() => setAccent(c)} style={[styles.swatchRing, accent === c && { borderColor: c }]}>
              <View style={[styles.swatch, { backgroundColor: c }]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            title="Сохранить"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={onSave}
            disabled={!!busy}
            icon={busy === 'save' ? <ActivityIndicator color={colors.text} /> : <Ionicons name="download-outline" size={20} color={colors.text} />}
          />
          <Button
            title="Поделиться"
            style={{ flex: 1 }}
            onPress={onShare}
            disabled={!!busy}
            icon={busy === 'share' ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="share-social" size={20} color={colors.accentText} />}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PhotoBtn({ icon, label, onPress, active }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.photoBtn, active && styles.photoBtnActive, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={active ? colors.accent : colors.text} />
      <Text style={styles.photoLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  hBtn: { width: 40 },
  hTitle: { flex: 1, fontFamily: fonts.bodyBold, color: colors.text, fontSize: 17, textAlign: 'center' },
  formatToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 2 },
  fBtn: { paddingHorizontal: 10, height: 28, justifyContent: 'center', borderRadius: 8 },
  fBtnActive: { backgroundColor: colors.surface2 },
  fText: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 12 },
  fTextActive: { color: colors.text },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardShadow: { borderRadius: 14, overflow: 'hidden', elevation: 10, backgroundColor: '#000' },
  controls: { paddingHorizontal: 16, paddingBottom: 8 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  photoBtnActive: { borderColor: colors.border },
  photoLabel: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 12 },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 14 },
  chipTextActive: { color: colors.bg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  logoTitle: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 13, marginRight: 4 },
  logoChip: { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center' },
  logoChipText: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 13 },
  swatches: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  swatchRing: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  actions: { flexDirection: 'row', gap: 10 },
});
