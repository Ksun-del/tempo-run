import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { StickerContent } from './Sticker';
import type { CardData, Composition, Sticker } from './model';

type Props = {
  comp: Composition;
  data: CardData;
  width: number;
  height: number;
  /** режим редактора: стикеры можно двигать, масштабировать и удалять */
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<Sticker>) => void;
  onRemove?: (id: string) => void;
};

/** Карточка: фон + стикеры. Одна и та же для превью, редактора и сохранения картинки. */
export default function CardCanvas({ comp, data, width, height, editable, selectedId, onSelect, onChange, onRemove }: Props) {
  const k = width / 360;
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#0B0B0C' }}>
      {comp.photo ? (
        <Image source={{ uri: comp.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#2A2A2F', '#0B0B0C']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {comp.photo && (
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']} locations={[0, 0.22]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}
      {comp.shade === 'bottom' && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']}
          locations={[0.35, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {comp.shade === 'full' && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} pointerEvents="none" />}

      {editable && <Pressable style={StyleSheet.absoluteFill} onPress={() => onSelect?.(null)} />}

      {comp.stickers.map((s) =>
        editable ? (
          <EditableSticker
            key={s.id}
            s={s}
            data={data}
            k={k}
            W={width}
            H={height}
            selected={selectedId === s.id}
            onSelect={() => onSelect?.(s.id)}
            onChange={(p) => onChange?.(s.id, p)}
            onRemove={() => onRemove?.(s.id)}
          />
        ) : (
          <View key={s.id} style={[styles.abs, position(s, width, height)]} pointerEvents="none">
            <View style={styles.frame}>
              <StickerContent s={s} data={data} k={k * s.scale} />
            </View>
          </View>
        ),
      )}
    </View>
  );
}

function position(s: Sticker, W: number, H: number): ViewStyle {
  const st: ViewStyle = {};
  if (s.anchor === 'tl' || s.anchor === 'bl') st.left = s.x * W;
  else st.right = s.x * W;
  if (s.anchor === 'tl' || s.anchor === 'tr') st.top = s.y * H;
  else st.bottom = s.y * H;
  return st;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function EditableSticker({
  s,
  data,
  k,
  W,
  H,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  s: Sticker;
  data: CardData;
  k: number;
  W: number;
  H: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (p: Partial<Sticker>) => void;
  onRemove: () => void;
}) {
  // PanResponder создаётся один раз, поэтому свежие значения читаем через ref
  const live = useRef({ s, W, H, onSelect, onChange });
  live.current = { s, W, H, onSelect, onChange };
  const box = useRef<View>(null);
  const start = useRef({ x: 0, y: 0, scale: 1, cx: 0, cy: 0, d0: 1 });

  const move = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const { s: cur } = live.current;
        start.current.x = cur.x;
        start.current.y = cur.y;
        live.current.onSelect();
      },
      onPanResponderMove: (_, g) => {
        const { s: cur, W: w, H: h } = live.current;
        const sx = cur.anchor === 'tr' || cur.anchor === 'br' ? -1 : 1;
        const sy = cur.anchor === 'bl' || cur.anchor === 'br' ? -1 : 1;
        live.current.onChange({
          x: clamp(start.current.x + (sx * g.dx) / w, -0.4, 1),
          y: clamp(start.current.y + (sy * g.dy) / h, -0.2, 1),
        });
      },
    }),
  ).current;

  const resize = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const px = e.nativeEvent.pageX;
        const py = e.nativeEvent.pageY;
        start.current.scale = live.current.s.scale;
        start.current.d0 = 0;
        box.current?.measure((_x, _y, w, h, pageX, pageY) => {
          start.current.cx = pageX + w / 2;
          start.current.cy = pageY + h / 2;
          start.current.d0 = Math.max(20, Math.hypot(px - start.current.cx, py - start.current.cy));
        });
      },
      onPanResponderMove: (e) => {
        if (!start.current.d0) return;
        const d = Math.hypot(e.nativeEvent.pageX - start.current.cx, e.nativeEvent.pageY - start.current.cy);
        live.current.onChange({ scale: clamp((start.current.scale * d) / start.current.d0, 0.3, 4) });
      },
    }),
  ).current;

  return (
    <View ref={box} style={[styles.abs, position(s, W, H)]} {...move.panHandlers}>
      <View style={[styles.frame, selected && styles.frameOn]}>
        <StickerContent s={s} data={data} k={k * s.scale} />
      </View>
      {selected && (
        <>
          <Pressable style={[styles.handle, { left: -12, top: -12 }]} onPress={onRemove} hitSlop={8}>
            <Ionicons name="close" size={16} color="#0B0B0C" />
          </Pressable>
          <View style={[styles.handle, { right: -12, bottom: -12 }]} {...resize.panHandlers} hitSlop={10}>
            <Ionicons name="resize" size={14} color="#0B0B0C" />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  frame: { padding: 4, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 6 },
  frameOn: { borderColor: 'rgba(255,255,255,0.9)', borderStyle: 'dashed' },
  handle: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
