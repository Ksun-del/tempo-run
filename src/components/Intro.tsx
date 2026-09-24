import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const PULSE = 'M4 62 H62 L76 34 L92 84 L108 12 L124 92 L137 56 H196';
const LEN = 420;

/** Заставка при запуске: на чёрном фоне «бежит» оранжевый пульс */
export default function Intro({ onDone }: { onDone: () => void }) {
  const draw = useRef(new Animated.Value(LEN)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(draw, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.delay(150),
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [draw, fade, onDone]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="none">
      <Svg width={220} height={110} viewBox="0 0 200 100">
        <AnimatedPath
          d={PULSE}
          stroke={colors.accent}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={[LEN, LEN]}
          strokeDashoffset={draw}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
