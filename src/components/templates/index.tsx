import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatDuration, formatKm, formatPace, formatShortDate, type TrackPoint } from '../../lib/geo';
import { fonts } from '../../lib/theme';
import TrackSvg from '../TrackSvg';

export type CardData = {
  title: string;
  startedAt: number;
  distanceM: number;
  durationMs: number;
  pace: number | null;
  elevationGainM: number;
  points: TrackPoint[];
  splits: { km: string; pace: number }[];
  name: string;
};

export type LogoId = 'none' | 'wordmark' | 'emblem';

export type CardProps = {
  data: CardData;
  photo: string | null;
  accent: string;
  width: number;
  height: number;
  logo: LogoId;
};

/** Логотипы бегового клуба Pobeda Run: прозрачный фон + чёрная обводка по контуру, видны на любом фото */
export const LOGOS: Record<Exclude<LogoId, 'none'>, { source: number; aspect: number; label: string }> = {
  emblem: { source: require('../../../assets/club/pobeda-emblem.png'), aspect: 800 / 717, label: 'Логотип 1' },
  wordmark: { source: require('../../../assets/club/pobeda-wordmark.png'), aspect: 757 / 800, label: 'Логотип 2' },
};

export type TemplateId = 'classic' | 'track' | 'minimal' | 'poster' | 'splits';

export const TEMPLATES: { id: TemplateId; name: string }[] = [
  { id: 'minimal', name: 'Плашки' },
  { id: 'poster', name: 'Крупно' },
  { id: 'classic', name: 'Классика' },
  { id: 'track', name: 'Маршрут' },
  { id: 'splits', name: 'Сплиты' },
];

/** Цвета клуба: жёлтый и белый */
export const ACCENTS = ['#FFB902', '#FFFFFF'];

/** Фон карточки: фото или тёмный градиент */
function Background({ photo, dim = 0, children }: { photo: string | null; dim?: number; children?: ReactNode }) {
  return (
    <>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#26262B', '#0B0B0C']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {dim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />}
      {children}
    </>
  );
}

/** Логотип клуба; если выбран «Без логотипа» — ничего не рисуем. height — высота в базовых единицах. */
function Mark({ k, logo, height = 64 }: { k: number; logo: LogoId; height?: number }) {
  if (logo === 'none') return null;
  const l = LOGOS[logo];
  const h = height * k * (logo === 'emblem' ? 0.9 : 1);
  return <Image source={l.source} style={{ width: h * l.aspect, height: h }} resizeMode="contain" />;
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

/* ───────────── 1. Классика ───────────── */
function Classic({ data, photo, accent, width, height, logo }: CardProps) {
  const k = width / 360;
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#000' }}>
      <Background photo={photo} />
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.2, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', top: 20 * k, left: 20 * k, right: 20 * k, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Mark k={k} logo={logo} height={78} />
          <Text style={{ fontFamily: fonts.bodyMedium, color: '#fff', fontSize: 11 * k, marginTop: 4 * k, ...shadow }}>
            {formatShortDate(data.startedAt)}
          </Text>
        </View>
        <TrackSvg points={data.points} width={96 * k} height={96 * k} color={accent} strokeWidth={3 * k} shadow />
      </View>
      <View style={{ position: 'absolute', left: 20 * k, right: 20 * k, bottom: 22 * k }}>
        <Text style={{ fontFamily: fonts.bodySemi, color: '#fff', fontSize: 14 * k, ...shadow }}>{data.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.display, color: accent, fontSize: 104 * k, lineHeight: 112 * k, ...shadow }}>
            {formatKm(data.distanceM)}
          </Text>
          <Text style={{ fontFamily: fonts.display, color: accent, fontSize: 26 * k, marginLeft: 6 * k, marginBottom: 18 * k }}>КМ</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 28 * k, marginTop: 4 * k }}>
          <MiniStat k={k} value={formatDuration(data.durationMs)} label="Время" />
          <MiniStat k={k} value={formatPace(data.pace)} label="Темп /км" />
          {data.elevationGainM > 0 && <MiniStat k={k} value={`${data.elevationGainM} м`} label="Набор" />}
        </View>
      </View>
    </View>
  );
}

function MiniStat({ k, value, label, color = '#fff' }: { k: number; value: string; label: string; color?: string }) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.display, color, fontSize: 26 * k, ...shadow }}>{value}</Text>
      <Text style={{ fontFamily: fonts.bodyMedium, color, opacity: 0.8, fontSize: 10 * k, textTransform: 'uppercase', letterSpacing: 1 * k }}>
        {label}
      </Text>
    </View>
  );
}

/* ───────────── 2. Маршрут ───────────── */
function Track({ data, photo, accent, width, height, logo }: CardProps) {
  const k = width / 360;
  const size = 132 * k;
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#000' }}>
      <Background photo={photo} dim={0.25} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 20 * k, left: 20 * k, right: 20 * k, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Mark k={k} logo={logo} height={70} />
        <Text style={{ fontFamily: fonts.bodySemi, color: '#fff', fontSize: 12 * k, ...shadow }}>{formatShortDate(data.startedAt)}</Text>
      </View>
      <View style={{ position: 'absolute', left: 16 * k, right: 16 * k, bottom: 20 * k }}>
        <View style={{ alignItems: 'flex-end', marginBottom: 10 * k }}>
          <TrackSvg points={data.points} width={size} height={size} color={accent} strokeWidth={5 * k} shadow />
        </View>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.45)', paddingTop: 14 * k }}>
          {[
            [formatKm(data.distanceM), 'км'],
            [formatDuration(data.durationMs), 'время'],
            [formatPace(data.pace), 'темп'],
          ].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, color: '#fff', fontSize: 30 * k, ...shadow }}>{v}</Text>
              <Text style={{ fontFamily: fonts.bodyMedium, color: accent, fontSize: 10 * k, textTransform: 'uppercase', letterSpacing: 1.5 * k }}>
                {l}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ───────────── 3. Плашки ───────────── */
/** Три плашки в углу без подписей: «5,73 км», «5'21" /км», «30:39» */
function Minimal({ data, photo, accent, width, height, logo }: CardProps) {
  const k = width / 360;
  const pill = (value: string, unit: string, main?: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        alignSelf: 'flex-start',
        backgroundColor: main ? accent : 'rgba(11,11,12,0.62)',
        borderRadius: 999,
        paddingHorizontal: 14 * k,
        paddingVertical: 5 * k,
        marginTop: 7 * k,
      }}
    >
      <Text style={{ fontFamily: fonts.display, color: main ? '#0B0B0C' : '#fff', fontSize: (main ? 30 : 22) * k }}>{value}</Text>
      {!!unit && (
        <Text style={{ fontFamily: fonts.bodySemi, color: main ? '#0B0B0C' : '#fff', opacity: 0.8, fontSize: 12 * k, marginLeft: 4 * k }}>
          {unit}
        </Text>
      )}
    </View>
  );
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#000' }}>
      <Background photo={photo} />
      <View style={{ position: 'absolute', top: 20 * k, left: 20 * k, right: 20 * k, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Mark k={k} logo={logo} height={64} />
          <Text style={{ fontFamily: fonts.bodySemi, color: '#fff', fontSize: 11 * k, marginTop: 4 * k, ...shadow }}>
            {formatShortDate(data.startedAt)}
          </Text>
        </View>
        <TrackSvg points={data.points} width={84 * k} height={84 * k} color={accent} strokeWidth={3 * k} shadow />
      </View>
      <View style={{ position: 'absolute', left: 18 * k, bottom: 20 * k }}>
        {pill(formatKm(data.distanceM), 'км', true)}
        {pill(formatPace(data.pace), '/км')}
        {pill(formatDuration(data.durationMs), '')}
      </View>
    </View>
  );
}

/* ───────────── 4. Крупно ───────────── */
/** Фото на весь фон с затемнением снизу, огромная цифра километров. */
function Poster({ data, photo, accent, width, height, logo }: CardProps) {
  const k = width / 360;
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#0B0B0C' }}>
      <Background photo={photo} />
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.25, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', top: 20 * k, left: 20 * k, right: 20 * k, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Mark k={k} logo={logo} height={70} />
        <Text style={{ fontFamily: fonts.bodySemi, color: '#fff', fontSize: 12 * k, ...shadow }}>{formatShortDate(data.startedAt)}</Text>
      </View>
      <View style={{ position: 'absolute', left: 22 * k, right: 22 * k, bottom: 22 * k }}>
        <Text style={{ fontFamily: fonts.bodyBlack, color: '#fff', fontSize: 13 * k, textTransform: 'uppercase', ...shadow }}>{data.title}</Text>
        <Text
          style={{ fontFamily: fonts.display, color: accent, fontSize: 130 * k, lineHeight: 134 * k, marginLeft: -4 * k, ...shadow }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatKm(data.distanceM)}
        </Text>
        <View style={{ height: 3 * k, backgroundColor: accent, marginVertical: 10 * k }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', gap: 22 * k }}>
            <MiniStat k={k} value={formatDuration(data.durationMs)} label="время" />
            <MiniStat k={k} value={formatPace(data.pace)} label="темп /км" />
          </View>
          <TrackSvg points={data.points} width={72 * k} height={72 * k} color={accent} strokeWidth={3 * k} shadow />
        </View>
      </View>
    </View>
  );
}

/* ───────────── 5. Сплиты ───────────── */
function Splits({ data, photo, accent, width, height, logo }: CardProps) {
  const k = width / 360;
  const rows = data.splits.slice(0, height / width > 1.5 ? 12 : 7);
  const fastest = Math.min(...rows.map((r) => r.pace));
  const slowest = Math.max(...rows.map((r) => r.pace));
  const span = slowest - fastest || 1;
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#000' }}>
      <Background photo={photo} dim={0.55} />
      <View style={{ flex: 1, padding: 22 * k, justifyContent: 'flex-end' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 * k }}>
          <View>
            <View style={{ marginBottom: 6 * k }}>
              <Mark k={k} logo={logo} height={56} />
            </View>
            <Text style={{ fontFamily: fonts.display, color: '#fff', fontSize: 58 * k, lineHeight: 64 * k }}>
              {formatKm(data.distanceM)} <Text style={{ fontSize: 22 * k }}>КМ</Text>
            </Text>
            <Text style={{ fontFamily: fonts.bodySemi, color: '#fff', fontSize: 13 * k }}>
              {formatDuration(data.durationMs)} · {formatPace(data.pace)} /км
            </Text>
          </View>
          <TrackSvg points={data.points} width={84 * k} height={84 * k} color={accent} strokeWidth={3 * k} />
        </View>
        {rows.map((r, i) => {
          const w = 35 + (65 * (slowest - r.pace)) / span;
          const best = r.pace === fastest && rows.length > 1;
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: 24 * k }}>
              <Text style={{ width: 40 * k, fontFamily: fonts.bodySemi, color: '#fff', fontSize: 12 * k }}>{r.km}</Text>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    width: `${w}%`,
                    height: 12 * k,
                    borderRadius: 3 * k,
                    backgroundColor: best ? accent : 'rgba(255,255,255,0.35)',
                  }}
                />
              </View>
              <Text style={{ width: 52 * k, textAlign: 'right', fontFamily: fonts.bodySemi, color: best ? accent : '#fff', fontSize: 12 * k }}>
                {formatPace(r.pace)}
              </Text>
            </View>
          );
        })}
        {rows.length === 0 && (
          <Text style={{ fontFamily: fonts.body, color: '#fff', opacity: 0.7, fontSize: 12 * k }}>Сплиты появятся после первого километра</Text>
        )}
      </View>
    </View>
  );
}

export function renderTemplate(id: TemplateId, props: CardProps) {
  switch (id) {
    case 'classic':
      return <Classic {...props} />;
    case 'track':
      return <Track {...props} />;
    case 'minimal':
      return <Minimal {...props} />;
    case 'poster':
      return <Poster {...props} />;
    case 'splits':
      return <Splits {...props} />;
  }
}
