import { Modal, StyleSheet, Text, View } from 'react-native';
import type { AchievementState } from '../lib/achievements';
import { colors, fonts } from '../lib/theme';
import Badge from './Badge';
import { Button } from './ui';

/** Окно «Новое достижение!» после финиша */
export default function NewAchievement({
  items,
  onClose,
  onCard,
}: {
  items: AchievementState[];
  onClose: () => void;
  onCard: (a: AchievementState) => void;
}) {
  const a = items[0];
  if (!a) return null;
  const rest = items.slice(1);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.eyebrow}>{items.length > 1 ? `Новые достижения · ${items.length}` : 'Новое достижение!'}</Text>
          <View style={styles.glow}>
            <Badge a={a} size={150} />
          </View>
          <Text style={styles.name}>{a.name}</Text>
          <Text style={styles.desc}>{a.desc}</Text>
          {rest.length > 0 && (
            <View style={styles.rest}>
              {rest.slice(0, 4).map((r) => (
                <View key={r.id} style={{ alignItems: 'center', width: 64 }}>
                  <Badge a={r} size={48} />
                  <Text style={styles.restName} numberOfLines={2}>
                    {r.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Button title="Сделать карточку" onPress={() => onCard(a)} style={{ alignSelf: 'stretch', marginTop: 18 }} />
          <Button title="Готово" kind="secondary" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  box: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: 28, padding: 22, alignItems: 'center' },
  eyebrow: { fontFamily: fonts.display, color: colors.accent, fontSize: 16, letterSpacing: 2, textTransform: 'uppercase' },
  glow: {
    marginTop: 14,
    borderRadius: 100,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  name: { fontFamily: fonts.display, color: colors.text, fontSize: 28, textTransform: 'uppercase', marginTop: 14, textAlign: 'center' },
  desc: { fontFamily: fonts.body, color: colors.muted, fontSize: 15, marginTop: 4, textAlign: 'center' },
  rest: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'center' },
  restName: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 2 },
});
