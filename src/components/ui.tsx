import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts } from '../lib/theme';

export function Stat({
  value,
  label,
  big,
  align = 'center',
  style,
}: {
  value: string;
  label: string;
  big?: boolean;
  align?: 'center' | 'flex-start';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ alignItems: align }, style]}>
      <Text style={[styles.statValue, big && styles.statBig]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  style,
  textStyle,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}) {
  const bg =
    kind === 'primary' ? colors.accent : kind === 'danger' ? colors.danger : kind === 'secondary' ? colors.surface2 : 'transparent';
  const fg = kind === 'primary' ? colors.accentText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.btnText, { color: fg }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  statValue: { fontFamily: fonts.display, color: colors.text, fontSize: 30, letterSpacing: 0.5 },
  statBig: { fontSize: 84, lineHeight: 92 },
  statLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 12, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  btn: {
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  section: {
    fontFamily: fonts.bodySemi,
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 24,
  },
});
