import { Image, Text, View } from 'react-native';
import { formatDuration, formatKm, formatPace, formatShortDate } from '../../lib/geo';
import { fonts } from '../../lib/theme';
import { ACH_BY_ID } from '../../lib/achievements';
import Badge, { PumpkinArt, TreeArt, VictoryStarArt } from '../Badge';
import TrackSvg from '../TrackSvg';
import { tintColor, type CardData, type Sticker } from './model';

/** Логотипы клуба Pobeda Run: прозрачный фон и чёрная обводка — видны на любом фото */
const LOGO = {
  logo1: { source: require('../../../assets/club/pobeda-emblem.png'), aspect: 800 / 717, h: 64 },
  logo2: { source: require('../../../assets/club/pobeda-wordmark.png'), aspect: 757 / 800, h: 72 },
};

const shadow = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

/** Содержимое стикера. k — масштаб: 1 единица = ширина карточки / 360, уже умноженная на scale стикера. */
export function StickerContent({ s, data, k }: { s: Sticker; data: CardData; k: number }) {
  const c = tintColor(s.tint);
  switch (s.kind) {
    case 'logo1':
    case 'logo2': {
      const l = LOGO[s.kind];
      return <Image source={l.source} style={{ width: l.h * l.aspect * k, height: l.h * k }} resizeMode="contain" />;
    }
    case 'badge': {
      const a = ACH_BY_ID[s.text ?? ''];
      if (!a) return null;
      return (
        <View style={{ alignItems: 'center', maxWidth: 200 * k }}>
          <Badge a={a} size={110 * k} />
          <Text style={{ fontFamily: fonts.display, color: c, fontSize: 20 * k, textTransform: 'uppercase', textAlign: 'center', marginTop: 6 * k, ...shadow }}>
            {a.name}
          </Text>
        </View>
      );
    }
    case 'pumpkin':
      return <PumpkinArt width={150 * k} />;
    case 'tree':
      return <TreeArt width={140 * k} />;
    case 'victory':
      return <VictoryStarArt width={140 * k} />;
    case 'date':
      return <Text style={{ fontFamily: fonts.bodySemi, color: c, fontSize: 13 * k, ...shadow }}>{formatShortDate(data.startedAt)}</Text>;
    case 'title':
      return (
        <Text style={{ fontFamily: fonts.bodyBlack, color: c, fontSize: 15 * k, textTransform: 'uppercase', maxWidth: 300 * k, ...shadow }}>
          {data.title}
        </Text>
      );
    case 'text':
      return (
        <Text style={{ fontFamily: fonts.display, color: c, fontSize: 30 * k, lineHeight: 36 * k, maxWidth: 320 * k, textTransform: 'uppercase', ...shadow }}>
          {s.text || 'Текст'}
        </Text>
      );
    case 'distance':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.display, color: c, fontSize: 64 * k, lineHeight: 70 * k, ...shadow }}>{formatKm(data.distanceM)}</Text>
          <Text style={{ fontFamily: fonts.display, color: c, fontSize: 18 * k, marginLeft: 4 * k, marginBottom: 12 * k, ...shadow }}>КМ</Text>
        </View>
      );
    case 'time':
      return <Value k={k} color={c} value={formatDuration(data.durationMs)} label="время" />;
    case 'pace':
      return <Value k={k} color={c} value={formatPace(data.pace)} label="темп /км" />;
    case 'stats':
      return (
        <View style={{ flexDirection: 'row', width: 320 * k }}>
          {[
            [formatKm(data.distanceM), 'км'],
            [formatDuration(data.durationMs), 'время'],
            [formatPace(data.pace), 'темп'],
          ].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, color: '#fff', fontSize: 30 * k, ...shadow }}>{v}</Text>
              <Text style={{ fontFamily: fonts.bodySemi, color: c, fontSize: 10 * k, textTransform: 'uppercase', letterSpacing: 1.5 * k, ...shadow }}>
                {l}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'pills': {
      const pill = (value: string, unit: string, main: boolean) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            alignSelf: 'flex-start',
            backgroundColor: main ? c : 'rgba(11,11,12,0.66)',
            borderRadius: 999,
            paddingHorizontal: 14 * k,
            paddingVertical: 4 * k,
            marginTop: 7 * k,
          }}
        >
          <Text style={{ fontFamily: fonts.display, color: main ? '#0B0B0C' : '#fff', fontSize: (main ? 30 : 22) * k }}>{value}</Text>
          {!!unit && (
            <Text style={{ fontFamily: fonts.bodySemi, color: main ? '#0B0B0C' : '#fff', opacity: 0.8, fontSize: 12 * k, marginLeft: 4 * k }}>{unit}</Text>
          )}
        </View>
      );
      return (
        <View>
          {pill(formatKm(data.distanceM), 'км', true)}
          {pill(formatPace(data.pace), '/км', false)}
          {pill(formatDuration(data.durationMs), '', false)}
        </View>
      );
    }
    case 'route':
      return <TrackSvg points={data.points} width={110 * k} height={110 * k} color={c} strokeWidth={4 * k} shadow />;
    case 'bigkm':
      return (
        <View style={{ width: 316 * k }}>
          <Text style={{ fontFamily: fonts.bodyBlack, color: '#fff', fontSize: 13 * k, textTransform: 'uppercase', ...shadow }}>{data.title}</Text>
          <Text style={{ fontFamily: fonts.display, color: c, fontSize: 124 * k, lineHeight: 130 * k, marginLeft: -4 * k, ...shadow }} numberOfLines={1}>
            {formatKm(data.distanceM)}
          </Text>
          <View style={{ height: 3 * k, backgroundColor: c, marginVertical: 10 * k }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', gap: 22 * k }}>
              <Value k={k} color="#fff" value={formatDuration(data.durationMs)} label="время" />
              <Value k={k} color="#fff" value={formatPace(data.pace)} label="темп /км" />
            </View>
            <TrackSvg points={data.points} width={70 * k} height={70 * k} color={c} strokeWidth={3 * k} shadow />
          </View>
        </View>
      );
    case 'classic':
      return (
        <View style={{ width: 320 * k }}>
          <Text style={{ fontFamily: fonts.bodySemi, color: '#fff', fontSize: 14 * k, ...shadow }}>{data.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.display, color: c, fontSize: 100 * k, lineHeight: 108 * k, ...shadow }}>{formatKm(data.distanceM)}</Text>
            <Text style={{ fontFamily: fonts.display, color: c, fontSize: 26 * k, marginLeft: 6 * k, marginBottom: 18 * k, ...shadow }}>КМ</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 28 * k, marginTop: 2 * k }}>
            <Value k={k} color="#fff" value={formatDuration(data.durationMs)} label="время" />
            <Value k={k} color="#fff" value={formatPace(data.pace)} label="темп /км" />
            {data.elevationGainM > 0 && <Value k={k} color="#fff" value={`${data.elevationGainM} м`} label="набор" />}
          </View>
        </View>
      );
    case 'splits': {
      const rows = data.splits.slice(0, 10);
      const fastest = Math.min(...rows.map((r) => r.pace));
      const slowest = Math.max(...rows.map((r) => r.pace));
      const span = slowest - fastest || 1;
      return (
        <View style={{ width: 316 * k }}>
          <Text style={{ fontFamily: fonts.display, color: '#fff', fontSize: 54 * k, lineHeight: 60 * k }}>
            {formatKm(data.distanceM)} <Text style={{ fontSize: 20 * k }}>КМ</Text>
          </Text>
          <Text style={{ fontFamily: fonts.bodySemi, color: '#fff', fontSize: 13 * k, marginBottom: 12 * k }}>
            {formatDuration(data.durationMs)} · {formatPace(data.pace)} /км
          </Text>
          {rows.map((r, i) => {
            const w = 35 + (65 * (slowest - r.pace)) / span;
            const best = r.pace === fastest && rows.length > 1;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: 24 * k }}>
                <Text style={{ width: 40 * k, fontFamily: fonts.bodySemi, color: '#fff', fontSize: 12 * k }}>{r.km}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ width: `${w}%`, height: 12 * k, borderRadius: 3 * k, backgroundColor: best ? c : 'rgba(255,255,255,0.35)' }} />
                </View>
                <Text style={{ width: 52 * k, textAlign: 'right', fontFamily: fonts.bodySemi, color: best ? c : '#fff', fontSize: 12 * k }}>
                  {formatPace(r.pace)}
                </Text>
              </View>
            );
          })}
          {rows.length === 0 && (
            <Text style={{ fontFamily: fonts.body, color: '#fff', opacity: 0.7, fontSize: 12 * k }}>Сплиты появятся после первого километра</Text>
          )}
        </View>
      );
    }
  }
}

function Value({ k, color, value, label, icon }: { k: number; color: string; value: string; label: string; icon?: string }) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.display, color, fontSize: 30 * k, ...shadow }}>
        {icon ? `${icon} ` : ''}
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.bodySemi, color, opacity: 0.85, fontSize: 10 * k, textTransform: 'uppercase', letterSpacing: 1 * k, ...shadow }}>
        {label}
      </Text>
    </View>
  );
}
