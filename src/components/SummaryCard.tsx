/**
 * Карточка «Мой сентябрь» / «Мой 2026» в формате сторис 9:16.
 * Все размеры — в «единицах»: ширина карточки = 360, k переводит их в точки экрана.
 */
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatDuration, formatPace } from '../lib/geo';
import { fill, type Gender } from '../lib/gender';
import { comparison, MONTHS, monthGen, type Summary } from '../lib/summary';
import { colors, fonts } from '../lib/theme';

const A = colors.accent;

function hours(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  if (h === 0) return `${m} мин`;
  return `${h} ч ${String(m).padStart(2, '0')} мин`;
}

function kmText(km: number) {
  return km >= 100 ? String(Math.round(km)) : km.toFixed(1).replace('.', ',');
}

function achWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'достижение';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'достижения';
  return 'достижений';
}

function runsWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'пробежка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пробежки';
  return 'пробежек';
}

export default function SummaryCard({ s, width, name, gender }: { s: Summary; width: number; name: string; gender: Gender }) {
  const k = width / 360;
  const height = (width * 16) / 9;
  const p = s.period;
  const title = p.month == null ? String(p.year) : MONTHS[p.month].toUpperCase();
  const cmp = comparison(s.km);
  const maxBar = Math.max(0.1, ...s.bars.map((b) => b.km));
  const prevName = p.month == null ? String(p.year - 1) : monthGen(p.month === 0 ? 11 : p.month - 1).replace(/я$/, 'ю').replace(/а$/, 'у');
  const timeWord = s.favTime === 'утро' ? 'утром' : s.favTime === 'день' ? 'днём' : 'вечером';

  const T = (size: number, extra: object = {}) => ({ fontSize: size * k, ...extra });

  return (
    <View style={{ width, height, backgroundColor: '#111113', overflow: 'hidden', padding: 24 * k }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5 * k, backgroundColor: A }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
        <Image source={require('../../assets/club/pobeda-emblem.png')} style={{ width: 36 * k * (800 / 717), height: 36 * k }} resizeMode="contain" />
        <Text style={[st.brand, T(12, { letterSpacing: 2 * k })]}>POBEDA RUN</Text>
        <View style={{ flex: 1 }} />
        {!!name && <Text style={[st.name, T(13)]} numberOfLines={1}>{name}</Text>}
      </View>

      <Text style={[st.my, T(18, { marginTop: 22 * k, letterSpacing: 3 * k })]}>МОЙ</Text>
      <Text style={[st.title, T(p.month == null ? 72 : 54, { lineHeight: (p.month == null ? 78 : 62) * k })]} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 * k }}>
        <Text style={[st.km, T(96, { lineHeight: 102 * k })]}>{kmText(s.km)}</Text>
        <Text style={[st.kmUnit, T(26, { marginLeft: 6 * k, marginBottom: 14 * k })]}>КМ</Text>
      </View>
      {!!cmp && <Text style={[st.cmp, T(14)]}>{cmp}</Text>}
      {s.vsPrev != null && (
        <View style={[st.chip, { paddingHorizontal: 10 * k, paddingVertical: 4 * k, borderRadius: 12 * k, marginTop: 8 * k }]}>
          <Text style={[st.chipText, T(12)]}>
            {s.vsPrev >= 0 ? `+${s.vsPrev}%` : `${s.vsPrev}%`} к {prevName}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 * k, rowGap: 14 * k }}>
        {[
          [String(s.runs), runsWord(s.runs)],
          [hours(s.timeMs), 'в движении'],
          [formatPace(s.pace), 'средний темп'],
          [`${kmText(s.longestKm)} км`, 'самая длинная'],
        ].map(([v, l]) => (
          <View key={l} style={{ width: '50%' }}>
            <Text style={[st.val, T(24)]} numberOfLines={1} adjustsFontSizeToFit>
              {v}
            </Text>
            <Text style={[st.lbl, T(11, { letterSpacing: 1 * k })]}>{l}</Text>
          </View>
        ))}
      </View>

      {s.favDay != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k, marginTop: 18 * k }}>
          <View style={[st.dayBox, { width: 50 * k, height: 50 * k, borderRadius: 14 * k }]}>
            <Text style={[st.dayText, T(20)]}>{s.favDayShort}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.favTitle, T(14)]}>любимый день — {s.favDayName}</Text>
            <Text style={[st.favSub, T(12)]}>
              {fill(`Чаще всего бегал{а} ${timeWord}`, gender)}
            </Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70 * k, gap: (p.month == null ? 5 : 10) * k }}>
        {s.bars.map((b, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <View
              style={{
                width: '100%',
                height: `${Math.max(b.km > 0 ? 6 : 2, (b.km / maxBar) * 72)}%`,
                backgroundColor: b.km > 0 ? A : 'rgba(255,255,255,0.12)',
                borderRadius: 3 * k,
              }}
            />
            <Text style={[st.barLbl, T(p.month == null ? 9 : 8, { marginTop: 4 * k })]} numberOfLines={1}>
              {b.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 * k }}>
        <Text style={[st.foot, T(12)]}>
          {s.achievements.length > 0 ? `${s.achievements.length} ${achWord(s.achievements.length)}` : 'RUN · Ростов-на-Дону'}
        </Text>
        {s.best5k != null && <Text style={[st.foot, T(12)]}>лучшие 5 км · {formatDuration(s.best5k)}</Text>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  brand: { fontFamily: fonts.bodyBlack, color: '#fff' },
  name: { fontFamily: fonts.bodySemi, color: 'rgba(255,255,255,0.7)', maxWidth: '45%' },
  my: { fontFamily: fonts.display, color: A },
  title: { fontFamily: fonts.display, color: '#fff' },
  km: { fontFamily: fonts.display, color: A },
  kmUnit: { fontFamily: fonts.display, color: A },
  cmp: { fontFamily: fonts.bodyMedium, color: '#fff', opacity: 0.85 },
  chip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,185,0,0.16)' },
  chipText: { fontFamily: fonts.bodySemi, color: A },
  val: { fontFamily: fonts.display, color: '#fff' },
  lbl: { fontFamily: fonts.bodySemi, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' },
  dayBox: { backgroundColor: A, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: fonts.display, color: '#0B0B0C' },
  favTitle: { fontFamily: fonts.bodySemi, color: '#fff' },
  favSub: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  barLbl: { fontFamily: fonts.bodySemi, color: 'rgba(255,255,255,0.5)' },
  foot: { fontFamily: fonts.bodySemi, color: 'rgba(255,255,255,0.7)' },
});
