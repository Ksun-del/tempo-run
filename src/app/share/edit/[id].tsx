import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CardCanvas from '../../../components/card/CardCanvas';
import { ACCENT, makeSet, makeSticker, RATIO, seasonalStickers, SETS, STICKER_MENU, type Sticker, type Tint } from '../../../components/card/model';
import { computeAchievements } from '../../../lib/achievements';
import { useRuns } from '../../../lib/hooks';
import Sheet, { SheetOption } from '../../../components/Sheet';
import { Button } from '../../../components/ui';
import { useDraft } from '../../../lib/cardStore';
import { pickPhoto } from '../../../lib/photo';
import { colors, fonts } from '../../../lib/theme';
import { useCardData } from '../../../lib/useCardData';

type SheetId = null | 'sets' | 'stickers' | 'text' | 'photo';

export default function StickerEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: sw, height: sh } = useWindowDimensions();
  const { data } = useCardData(id);
  const [comp, setComp] = useDraft(id);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [text, setText] = useState('');
  const [editingText, setEditingText] = useState<string | null>(null);
  const { runs } = useRuns();
  const earned = useMemo(() => computeAchievements(runs).filter((a) => a.earnedAt != null), [runs]);
  const seasonal = useMemo(() => seasonalStickers(), []);

  const ratio = RATIO[comp.format];
  const cardW = Math.min(sw - 40, (sh * 0.6) / ratio);
  const cardH = cardW * ratio;
  const sel = comp.stickers.find((s) => s.id === selected) ?? null;

  const update = (sid: string, patch: Partial<Sticker>) =>
    setComp((c) => ({ ...c, set: null, stickers: c.stickers.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }));
  const remove = (sid: string) => {
    setComp((c) => ({ ...c, set: null, stickers: c.stickers.filter((s) => s.id !== sid) }));
    setSelected(null);
  };
  // выбранный стикер поднимаем наверх, чтобы его не перекрывали другие
  const select = (sid: string | null) => {
    setSelected(sid);
    if (sid)
      setComp((c) => {
        const i = c.stickers.findIndex((s) => s.id === sid);
        if (i < 0 || i === c.stickers.length - 1) return c;
        const list = [...c.stickers];
        const [s] = list.splice(i, 1);
        return { ...c, stickers: [...list, s] };
      });
  };
  const add = (s: Sticker) => {
    setComp((c) => ({ ...c, set: null, stickers: [...c.stickers, s] }));
    setSelected(s.id);
    setSheet(null);
  };

  const openText = (existing?: Sticker) => {
    setEditingText(existing?.id ?? null);
    setText(existing?.text ?? '');
    setSheet('text');
  };
  const saveText = () => {
    const t = text.trim();
    if (t) {
      if (editingText) update(editingText, { text: t });
      else add(makeSticker('text', t));
    }
    setSheet(null);
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    setSheet(null);
    const uri = await pickPhoto(source, comp.format);
    if (uri) setComp((c) => ({ ...c, photo: uri }));
  };

  if (!data) return <View style={styles.root} />;

  const thumbW = 96;
  const thumbH = thumbW * ratio;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.hTitle}>Стикеры</Text>
        <View style={styles.hBtn} />
      </View>

      <View style={styles.canvasArea}>
        <View style={[styles.canvas, { width: cardW, height: cardH }]}>
          <CardCanvas
            comp={comp}
            data={data}
            width={cardW}
            height={cardH}
            editable
            selectedId={selected}
            onSelect={select}
            onChange={update}
            onRemove={remove}
          />
        </View>
      </View>

      <View style={styles.selBar}>
        {sel ? (
          <>
            {(['accent', 'white'] as Tint[]).map((t) => (
              <Pressable key={t} onPress={() => update(sel.id, { tint: t })} style={[styles.dotRing, sel.tint === t && { borderColor: colors.text }]}>
                <View style={[styles.dot, { backgroundColor: t === 'accent' ? ACCENT : '#FFFFFF' }]} />
              </Pressable>
            ))}
            {sel.kind === 'text' && <SmallBtn icon="create-outline" label="Изменить" onPress={() => openText(sel)} />}
            <SmallBtn icon="trash-outline" label="Удалить" onPress={() => remove(sel.id)} />
          </>
        ) : (
          <Text style={styles.hint}>Нажми на стикер, чтобы двигать его, менять размер и цвет</Text>
        )}
      </View>

      <View style={styles.toolbar}>
        <Tool icon="layers-outline" label="Наборы" onPress={() => setSheet('sets')} />
        <Tool icon="add" label="Стикер" onPress={() => setSheet('stickers')} />
        <Tool icon="text" label="Текст" onPress={() => openText()} />
        <Tool icon="image-outline" label="Фото" onPress={() => setSheet('photo')} />
      </View>

      <Button title="Готово" onPress={() => router.back()} style={{ marginHorizontal: 16, marginTop: 10 }} />

      <Sheet visible={sheet === 'sets'} title="Наборы" onClose={() => setSheet(null)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
          {SETS.map((set) => {
            const preview = { ...comp, set: set.id, ...makeSet(set.id, comp.format) };
            const active = comp.set === set.id;
            return (
              <Pressable
                key={set.id}
                onPress={() => {
                  setComp((c) => ({ ...c, set: set.id, ...makeSet(set.id, c.format) }));
                  setSelected(null);
                  setSheet(null);
                }}
                style={{ alignItems: 'center' }}
              >
                <View style={[styles.thumb, { width: thumbW, height: thumbH }, active && styles.thumbActive]} pointerEvents="none">
                  <CardCanvas comp={preview} data={data} width={thumbW} height={thumbH} />
                </View>
                <Text style={[styles.thumbLabel, active && { color: colors.accent }]}>{set.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.sheetNote}>Набор заменит стикеры на карточке. Фото останется.</Text>
      </Sheet>

      <Sheet visible={sheet === 'stickers'} title="Добавить стикер" onClose={() => setSheet(null)}>
        <View style={styles.chips}>
          {STICKER_MENU.map((m) => (
            <Pressable key={m.kind} onPress={() => add(makeSticker(m.kind))} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}>
              <Text style={styles.chipText}>+ {m.label}</Text>
            </Pressable>
          ))}
        </View>
        {seasonal.length > 0 && (
          <>
            <Text style={styles.chipsTitle}>Праздничные</Text>
            <View style={styles.chips}>
              {seasonal.map((m) => (
                <Pressable key={m.kind} onPress={() => add(makeSticker(m.kind))} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.chipText}>+ {m.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {earned.length > 0 && (
          <>
            <Text style={styles.chipsTitle}>Мои достижения</Text>
            <View style={styles.chips}>
              {earned.map((a) => (
                <Pressable key={a.id} onPress={() => add(makeSticker('badge', a.id))} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.chipText}>+ {a.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Text style={styles.sheetNote}>Стикер появится на карточке — передвинь его, куда хочешь.</Text>
        <Pressable
          onPress={() => {
            setComp((c) => ({ ...c, set: null, stickers: [] }));
            setSelected(null);
            setSheet(null);
          }}
        >
          <Text style={styles.clearAll}>Убрать все стикеры</Text>
        </Pressable>
      </Sheet>

      <Sheet visible={sheet === 'text'} title={editingText ? 'Изменить текст' : 'Свой текст'} onClose={() => setSheet(null)}>
        <KeyboardAvoidingView behavior="padding">
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            placeholder="Например: Первый полумарафон!"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={60}
            onSubmitEditing={saveText}
            returnKeyType="done"
          />
          <Button title={editingText ? 'Сохранить' : 'Добавить'} onPress={saveText} style={{ marginTop: 12 }} />
        </KeyboardAvoidingView>
      </Sheet>

      <Sheet visible={sheet === 'photo'} title="Фото" onClose={() => setSheet(null)}>
        <SheetOption icon={<Ionicons name="camera-outline" size={22} color={colors.text} />} label="Сделать фото" onPress={() => choosePhoto('camera')} />
        <SheetOption icon={<Ionicons name="images-outline" size={22} color={colors.text} />} label="Выбрать из галереи" onPress={() => choosePhoto('library')} />
        {comp.photo && (
          <SheetOption
            icon={<Ionicons name="trash-outline" size={22} color={colors.danger} />}
            label="Убрать фото"
            danger
            onPress={() => {
              setSheet(null);
              setComp((c) => ({ ...c, photo: null }));
            }}
          />
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function Tool({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

function SmallBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }): ReactNode {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={16} color={colors.text} />
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  hBtn: { width: 40 },
  hTitle: { flex: 1, fontFamily: fonts.display, color: colors.text, fontSize: 20, textTransform: 'uppercase', textAlign: 'center' },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  canvas: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  selBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  hint: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center' },
  dotRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.surface2 },
  smallBtnText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 13 },
  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  tool: { flex: 1, height: 64, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  toolText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 12 },
  thumb: { borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: colors.accent },
  thumbLabel: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 13, marginTop: 6 },
  sheetNote: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsTitle: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 13, marginTop: 14, marginBottom: 8 },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,185,0,0.14)', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 14 },
  clearAll: { fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 14, marginTop: 14, marginBottom: 4 },
  input: {
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
});
