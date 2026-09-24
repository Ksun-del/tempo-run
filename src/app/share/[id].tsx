import Ionicons from '@expo/vector-icons/Ionicons';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import CardCanvas from '../../components/card/CardCanvas';
import { makeSet, RATIO, type Format } from '../../components/card/model';
import Sheet, { SheetOption } from '../../components/Sheet';
import { useDraft } from '../../lib/cardStore';
import { pickPhoto } from '../../lib/photo';
import { colors, fonts } from '../../lib/theme';
import { useCardData } from '../../lib/useCardData';

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: sw, height: sh } = useWindowDimensions();
  const { data } = useCardData(id);
  const [comp, setComp] = useDraft(id);
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const card = useRef<View>(null);

  const ratio = RATIO[comp.format];
  const cardW = Math.min(sw - 64, (sh * 0.52) / ratio);
  const cardH = cardW * ratio;

  const setFormat = (f: Format) =>
    setComp((c) => (c.format === f ? c : { ...c, format: f, ...(c.set ? makeSet(c.set, f) : {}) }));

  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoSheet(false);
    const uri = await pickPhoto(source, comp.format);
    if (uri) setComp((c) => ({ ...c, photo: uri }));
  };

  const capture = () =>
    captureRef(card, { format: 'jpg', quality: 0.95, width: 1080, height: Math.round(1080 * ratio), result: 'tmpfile' });

  const onSave = async () => {
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!perm.granted) {
        Alert.alert('Нет доступа к галерее', 'Разреши сохранение фото в настройках телефона.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(await capture());
      Alert.alert('Готово', 'Картинка сохранена в галерею.');
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
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.hTitle}>Поделиться</Text>
        <View style={styles.formatToggle}>
          {(['story', 'post'] as Format[]).map((f) => (
            <Pressable key={f} onPress={() => setFormat(f)} style={[styles.fBtn, comp.format === f && styles.fBtnActive]}>
              <Text style={[styles.fText, comp.format === f && styles.fTextActive]}>{f === 'story' ? '9:16' : '4:5'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Pressable onPress={() => router.push(`/share/edit/${id}`)} style={styles.previewArea}>
          <View style={[styles.cardShadow, { width: cardW, height: cardH }]}>
            <View ref={card} collapsable={false}>
              <CardCanvas comp={comp} data={data} width={cardW} height={cardH} />
            </View>
          </View>
        </Pressable>

        <View style={styles.tiles}>
          <Tile icon={<Ionicons name="image-outline" size={22} color={colors.accent} />} label={comp.photo ? 'Сменить фото' : 'Добавить фото'} onPress={() => setPhotoSheet(true)} />
          <Tile icon={<Ionicons name="happy-outline" size={22} color={colors.accent} />} label="Стикеры" onPress={() => router.push(`/share/edit/${id}`)} />
        </View>

        <View style={styles.list}>
          <Row
            icon={busy === 'save' ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="download-outline" size={22} color={colors.accent} />}
            title="Сохранить картинку"
            sub="В галерею телефона"
            onPress={onSave}
            disabled={!!busy}
          />
          <Row
            icon={busy === 'share' ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="share-social-outline" size={22} color={colors.accent} />}
            title="Поделиться"
            sub="В сторис, соцсети или мессенджеры"
            onPress={onShare}
            disabled={!!busy}
          />
        </View>
      </ScrollView>

      <Sheet visible={photoSheet} title="Фото" onClose={() => setPhotoSheet(false)}>
        <SheetOption icon={<Ionicons name="camera-outline" size={22} color={colors.text} />} label="Сделать фото" onPress={() => choosePhoto('camera')} />
        <SheetOption icon={<Ionicons name="images-outline" size={22} color={colors.text} />} label="Выбрать из галереи" onPress={() => choosePhoto('library')} />
        {comp.photo && (
          <SheetOption
            icon={<Ionicons name="trash-outline" size={22} color={colors.danger} />}
            label="Убрать фото"
            danger
            onPress={() => {
              setPhotoSheet(false);
              setComp((c) => ({ ...c, photo: null }));
            }}
          />
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function Tile({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  );
}

function Row({ icon, title, sub, onPress, disabled }: { icon: ReactNode; title: string; sub: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  hBtn: { width: 64 },
  hTitle: { flex: 1, fontFamily: fonts.display, color: colors.text, fontSize: 20, textTransform: 'uppercase', textAlign: 'center' },
  formatToggle: { width: 64, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 2 },
  fBtn: { flex: 1, height: 26, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  fBtnActive: { backgroundColor: colors.surface2 },
  fText: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 10 },
  fTextActive: { color: colors.text },
  previewArea: { alignItems: 'center', paddingVertical: 12 },
  cardShadow: { borderRadius: 18, overflow: 'hidden', elevation: 10, backgroundColor: '#000' },
  tiles: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 8 },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,185,0,0.55)',
    paddingHorizontal: 14,
  },
  tileIcon: { width: 32, alignItems: 'center' },
  tileText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
  list: { marginTop: 18, marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,185,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 16 },
  rowSub: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: 2 },
});
