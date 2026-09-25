/** Настройки → Кроссовки: пары, пробег, какая пара сейчас в работе */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRuns } from '../lib/hooks';
import { addShoe, deleteShoe, shoeKm, shoeState, updateShoe, useShoes, type Shoe } from '../lib/shoes';
import { saveSettings, type Settings } from '../lib/storage';
import { reloadSettings } from '../lib/tracker';
import { colors, fonts } from '../lib/theme';
import Sheet, { SheetOption } from './Sheet';

const LIMITS = [500, 600, 700, 800, 1000];

export default function ShoesSection({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const shoes = useShoes();
  const { runs } = useRuns();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [startKm, setStartKm] = useState('');
  const [open, setOpen] = useState<Shoe | null>(null);
  const [limitFor, setLimitFor] = useState<Shoe | null>(null);

  const setActive = async (id: string | null) => {
    const next = await saveSettings({ activeShoeId: id });
    reloadSettings();
    onSettings(next);
  };

  const onAdd = async () => {
    const shoe = await addShoe(name, Number(startKm.replace(',', '.')) || 0);
    setAdding(false);
    setName('');
    setStartKm('');
    await setActive(shoe.id);
  };

  const active = shoes.filter((s) => !s.retired);
  const retired = shoes.filter((s) => s.retired);

  const row = (s: Shoe) => {
    const km = shoeKm(s, runs);
    const st = shoeState(km, s.limitKm);
    const isActive = settings.activeShoeId === s.id;
    return (
      <Pressable key={s.id} style={({ pressed }) => [styles.shoe, pressed && { opacity: 0.8 }, s.retired && { opacity: 0.5 }]} onPress={() => setOpen(s)}>
        <View style={styles.shoeTop}>
          <Text style={styles.shoeName} numberOfLines={1}>
            {s.name}
          </Text>
          {isActive && <Text style={styles.now}>СЕЙЧАС</Text>}
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
        </View>
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${Math.min(100, (km / s.limitKm) * 100)}%` }, st !== 'ok' && { backgroundColor: colors.orange }]} />
        </View>
        <Text style={[styles.shoeSub, st !== 'ok' && { color: colors.accent }]}>
          {Math.round(km)} из {s.limitKm} км
          {st === 'worn' ? ' · пора менять' : st === 'soon' ? ' · скоро пора менять' : ''}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      {shoes.length === 0 && (
        <Text style={styles.tip}>Добавь свои кроссовки — RUN будет считать их пробег и подскажет, когда пора менять (обычно после 600–800 км).</Text>
      )}
      {active.map(row)}
      {retired.length > 0 && <Text style={styles.retiredTitle}>На пенсии</Text>}
      {retired.map(row)}
      <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
        <Ionicons name="add" size={18} color={colors.accent} />
        <Text style={styles.addText}>Добавить кроссовки</Text>
      </Pressable>

      <Sheet visible={adding} title="Новые кроссовки" onClose={() => setAdding(false)}>
        <Text style={styles.label}>Название</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Например, Asics Novablast" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={[styles.label, { marginTop: 12 }]}>Уже набегано в них, км (если не новые)</Text>
        <TextInput
          value={startKm}
          onChangeText={(t) => setStartKm(t.replace(/[^0-9.,]/g, '').slice(0, 6))}
          placeholder="0"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <Text style={[styles.tip, { marginTop: 10, color: colors.muted, fontSize: 13 }]}>
          Новые пробежки будут засчитываться этой паре. Поменять пару можно в любой момент здесь или на экране пробежки.
        </Text>
        <Pressable style={[styles.primary, !name.trim() && { opacity: 0.4 }]} disabled={!name.trim()} onPress={onAdd}>
          <Text style={styles.primaryText}>Добавить</Text>
        </Pressable>
      </Sheet>

      <Sheet visible={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open && !open.retired && settings.activeShoeId !== open.id && (
          <SheetOption
            icon={<Ionicons name="footsteps" size={20} color={colors.accent} />}
            label="Бегаю в них"
            onPress={() => {
              setActive(open.id);
              setOpen(null);
            }}
          />
        )}
        {open && (
          <SheetOption
            icon={<Ionicons name="speedometer-outline" size={20} color={colors.text} />}
            label={`Менять после ${open.limitKm} км`}
            onPress={() => {
              setLimitFor(open);
              setOpen(null);
            }}
          />
        )}
        {open && (
          <SheetOption
            icon={<Ionicons name={open.retired ? 'refresh' : 'archive-outline'} size={20} color={colors.text} />}
            label={open.retired ? 'Вернуть в работу' : 'Отправить на пенсию'}
            onPress={async () => {
              const s = open;
              setOpen(null);
              await updateShoe(s.id, { retired: !s.retired });
              if (!s.retired && settings.activeShoeId === s.id) setActive(null);
            }}
          />
        )}
        {open && (
          <SheetOption
            icon={<Ionicons name="trash-outline" size={20} color={colors.danger} />}
            label="Удалить"
            danger
            onPress={() => {
              const s = open;
              setOpen(null);
              Alert.alert('Удалить кроссовки?', 'Пробежки останутся, просто без привязки к этой паре.', [
                { text: 'Отмена', style: 'cancel' },
                {
                  text: 'Удалить',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteShoe(s.id);
                    if (settings.activeShoeId === s.id) setActive(null);
                  },
                },
              ]);
            }}
          />
        )}
      </Sheet>

      <Sheet visible={!!limitFor} title="Когда менять" onClose={() => setLimitFor(null)}>
        <Text style={[styles.tip, { color: colors.muted, marginBottom: 12 }]}>Обычно беговые кроссовки служат 600–800 км. Лёгкие гоночные — меньше.</Text>
        <View style={styles.limits}>
          {LIMITS.map((v) => (
            <Pressable
              key={v}
              style={[styles.limit, limitFor?.limitKm === v && { backgroundColor: colors.accent }]}
              onPress={async () => {
                const s = limitFor;
                setLimitFor(null);
                if (s) await updateShoe(s.id, { limitKm: v });
              }}
            >
              <Text style={[styles.limitText, limitFor?.limitKm === v && { color: colors.accentText }]}>{v} км</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}


const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 },
  tip: { fontFamily: fonts.body, color: colors.text, fontSize: 14, lineHeight: 21 },
  shoe: { backgroundColor: colors.surface2, borderRadius: 12, padding: 12 },
  shoeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shoeName: { flex: 1, fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
  now: { fontFamily: fonts.bodyBold, color: colors.accentText, backgroundColor: colors.accent, fontSize: 10, letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.bg, marginTop: 10, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  shoeSub: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 6 },
  retiredTitle: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  addText: { fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 14 },
  label: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginBottom: 8 },
  input: { fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 16, backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 12, height: 46 },
  primary: { height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 },
  primaryText: { fontFamily: fonts.bodyBold, color: colors.accentText, fontSize: 16 },
  limits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  limit: { height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.surface2, justifyContent: 'center' },
  limitText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15 },
});
