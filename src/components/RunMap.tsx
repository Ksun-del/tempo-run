import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { TrackPoint } from '../lib/geo';
import { colors } from '../lib/theme';
import MapFrame, { type MapFrameHandle } from './MapFrame';
import { buildMapHtml, type MapStyle } from './mapHtml';

export type RunMapHandle = { recenter: () => void };

type Props = {
  points: TrackPoint[];
  me?: { lat: number; lon: number } | null;
  /** live — следим за бегуном; static — показываем весь маршрут */
  mode: 'live' | 'static';
  mapStyle?: MapStyle;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  fitPadding?: number;
};

const pack = (pts: TrackPoint[]) => JSON.stringify(pts.map((p) => [p.lat, p.lon, p.seg]));

const RunMap = forwardRef<RunMapHandle, Props>(function RunMap(
  { points, me, mode, mapStyle = 'dark', interactive = true, style, fitPadding = 36 },
  ref,
) {
  const frame = useRef<MapFrameHandle>(null);
  const [ready, setReady] = useState(false);
  const sent = useRef(0);
  const html = useMemo(() => buildMapHtml(mapStyle, interactive), [mapStyle, interactive]);
  const onReady = useCallback(() => setReady(true), []);
  const onReload = useCallback(() => {
    setReady(false);
    sent.current = 0;
  }, []);

  useImperativeHandle(ref, () => ({ recenter: () => frame.current?.run('tempo.recenter()') }));

  useEffect(() => {
    setReady(false);
    sent.current = 0;
  }, [html]);

  useEffect(() => {
    if (!ready) return;
    if (points.length < sent.current || sent.current === 0) {
      frame.current?.run(`tempo.setTrack(${pack(points)})`);
    } else if (points.length > sent.current) {
      frame.current?.run(`tempo.append(${pack(points.slice(sent.current))})`);
    }
    sent.current = points.length;
    if (mode === 'static') frame.current?.run(`tempo.fit(${fitPadding})`);
  }, [ready, points, points.length, mode, fitPadding]);

  useEffect(() => {
    if (ready && me && mode === 'live') frame.current?.run(`tempo.setMe(${me.lat},${me.lon})`);
  }, [ready, me?.lat, me?.lon, mode]);

  return (
    <View style={[styles.wrap, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <MapFrame ref={frame} html={html} onReady={onReady} onReload={onReload} />
    </View>
  );
});

export default RunMap;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.bg },
});
