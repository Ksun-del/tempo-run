import { memo, useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { AchievementDef, BadgeIcon, BadgeShape } from '../lib/achievements';
import { fonts } from '../lib/theme';

const ORANGE = '#FFB900';
const INK = '#141414';
const LOCK = '#3A3A40';
const LOCK_INK = '#6E6E76';

function Shape({ shape, fill, stroke }: { shape: BadgeShape; fill: string; stroke: string }) {
  switch (shape) {
    case 'circle':
      return (
        <>
          <Circle cx={50} cy={50} r={44} fill={fill} stroke={stroke} strokeWidth={4} />
          <Circle cx={50} cy={50} r={36} fill="none" stroke={INK} strokeWidth={2} opacity={0.3} />
        </>
      );
    case 'hex':
      return <Path d="M50 5l39 22.5v45L50 95 11 72.5v-45z" fill={fill} stroke={stroke} strokeWidth={4} strokeLinejoin="round" />;
    case 'shield':
      return <Path d="M50 5l38 12v26c0 25-16 42-38 52C28 85 12 68 12 43V17z" fill={fill} stroke={stroke} strokeWidth={4} strokeLinejoin="round" />;
    case 'round':
      return <Rect x={8} y={8} width={84} height={84} rx={24} fill={fill} stroke={stroke} strokeWidth={4} />;
    case 'star':
      return (
        <Path
          d="M50 4l12 14 18-4 2 18 16 9-10 15 6 17-18 3-8 17-18-8-18 8-8-17-18-3 6-17-10-15 16-9 2-18 18 4z"
          fill={fill}
          stroke={stroke}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      );
  }
}

const SHOE = 'M17 66c-1.6-8-1.4-17 1.6-24 2.2-5 6-7.6 11-8.4l4.6 6.2c3.6-2.2 6.4-6 8-10.6 3.4-.6 6.4.4 8 2.8l13 16.4c6 2.6 14 4.4 20.6 6.4 4.6 1.4 7.2 5 6.6 11.2z';

function Icon({ name, c, bg, clipId }: { name: BadgeIcon; c: string; bg: string; clipId: string }) {
  const st = { stroke: c, strokeWidth: 5, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'shoe':
      return (
        <G>
          <Defs>
            <ClipPath id={clipId}>
              <Path d={SHOE} />
            </ClipPath>
          </Defs>
          <Path d={SHOE} fill={c} />
          <Path d="M14 67h76c.6 5.6-2.4 9-7.4 9H20.6c-4.4 0-7-3.6-6.6-9z" fill={c} />
          <Path d="M16 70.4h72" stroke={bg} strokeWidth={1.8} />
          <G clipPath={`url(#${clipId})`}>
            <Path d="M10 56h20l5-9 6 16 7-22 6 19 4-6h34" stroke={bg} strokeWidth={3.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </G>
          <Path d="M45 35.5l3.4-2.4M49.5 41l3.4-2.4M54 46.5l3.4-2.4" stroke={bg} strokeWidth={2.2} strokeLinecap="round" />
        </G>
      );
    case 'trophy':
      return (
        <G stroke={c} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M33 25h34v14c0 11-7.5 18-17 18s-17-7-17-18z" />
          <Path d="M33 29h-7c-1.5 8 2.5 14 9 15M67 29h7c1.5 8-2.5 14-9 15" />
          <Path d="M50 57v8M41 65h18l2 8H39z" />
          <Path d="M36.5 38h6l3-6 4.5 12 3.5-9 2.5 3h7.5" />
          <Path d="M22 21l3 3M78 21l-3 3M20 52h3M77 52h3" strokeWidth={2.4} />
        </G>
      );
    case 'club':
      return (
        <G>
          <Circle cx={38} cy={44} r={8} {...st} />
          <Circle cx={62} cy={44} r={8} {...st} />
          <Path d="M24 70c2-9 8-13 14-13s12 4 14 13M48 70c2-9 8-13 14-13s12 4 14 13" {...st} />
        </G>
      );
    case 'fire':
      return <Path d="M50 24c4 12 18 18 18 34a18 18 0 0 1-36 0c0-8 5-12 8-16 1 6 4 8 6 8-2-10 0-18 4-26z" {...st} />;
    case 'sun':
      return (
        <G>
          <Circle cx={50} cy={56} r={11} {...st} />
          <Path d="M50 30v6M30 56h-6M76 56h-6M36 42l-4-4M64 42l4-4M26 72h48" {...st} />
        </G>
      );
    case 'moon':
      return <Path d="M58 30a22 22 0 1 0 14 34 18 18 0 0 1-14-34z" {...st} />;
    case 'rain':
      return <Path d="M30 52a14 14 0 0 1 26-8 11 11 0 0 1 14 12H30zM38 64l-3 8M52 64l-3 8M66 64l-3 8" {...st} />;
    case 'snow':
      return <Path d="M50 30v44M31 41l38 22M31 63l38-22M44 32l6 6 6-6M44 72l6-6 6 6" {...st} />;
    case 'flower':
      return (
        <G>
          <Circle cx={50} cy={48} r={6} {...st} />
          <Path d="M50 42c-4-12 8-12 0 0zM56 48c12-4 12 8 0 0zM50 54c4 12-8 12 0 0zM44 48c-12 4-12-8 0 0zM50 60v14" {...st} />
        </G>
      );
    case 'pumpkin':
      return (
        <G>
          <Path d="M50 36c-2-6 0-10 5-12 1 2 0 4-2 5 0 2 0 5 1 7z" fill={c} />
          <Path d="M50 38c-7-4-19-2-22 10-2 9 3 19 12 21 3 .8 7 .6 10-.6 3 1.2 7 1.4 10 .6 9-2 14-12 12-21-3-12-15-14-22-10z" fill={c} />
          <Path d="M38 49l6-4 2 7zM62 49l-6-4-2 7zM36 58h8l3-5 3.5 9 3.5-7 2.5 3H64c-1 4-6 7-14 7s-13-3-14-7z" fill={bg} />
        </G>
      );
  }
}

/** Значок достижения. locked — серый; секретные без получения показывают «???». */
function Badge({ a, size = 64, locked = false }: { a: AchievementDef; size?: number; locked?: boolean }) {
  const clipId = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fill = locked ? LOCK : ORANGE;
  const stroke = locked ? '#4A4A50' : '#FFFFFF';
  const ink = locked ? LOCK_INK : INK;
  const hidden = locked && a.secret;
  const bigSize = !a.big ? 0 : a.big.length > 3 ? 24 : a.big.length > 2 ? 30 : 36;
  const smallLong = (a.small?.length ?? 0) > 6;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Shape shape={a.shape} fill={fill} stroke={stroke} />
      {hidden ? (
        <SvgText x={50} y={60} textAnchor="middle" fontFamily={fonts.display} fontSize={30} fill={ink}>
          ???
        </SvgText>
      ) : a.icon ? (
        <Icon name={a.icon} c={ink} bg={fill} clipId={clipId} />
      ) : (
        <>
          <SvgText x={50} y={a.small ? 52 : 60} textAnchor="middle" fontFamily={fonts.display} fontSize={bigSize} fill={ink}>
            {a.big}
          </SvgText>
          {!!a.small && (
            <SvgText x={50} y={69} textAnchor="middle" fontFamily={fonts.displayMedium} fontSize={smallLong ? 8.5 : 12} letterSpacing={smallLong ? 0.3 : 1} fill={ink}>
              {a.small}
            </SvgText>
          )}
        </>
      )}
    </Svg>
  );
}

export default memo(Badge);

/* ——— праздничные стикеры ——— */

export function PumpkinArt({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.9} viewBox="0 0 200 180">
      <Path d="M102 44c-3-14 2-26 14-32 3-1.5 6 2 4 4.5-8 6-11 15-9 27z" fill="#4E7A2A" />
      <Path d="M112 22c10-10 26-8 30 2-8 0-14 4-20 2" fill="none" stroke="#5E8F31" strokeWidth={4} strokeLinecap="round" />
      <Ellipse cx={58} cy={108} rx={42} ry={56} fill="#B6560A" />
      <Ellipse cx={142} cy={108} rx={42} ry={56} fill="#B6560A" />
      <Ellipse cx={78} cy={106} rx={40} ry={62} fill="#E07A0B" />
      <Ellipse cx={122} cy={106} rx={40} ry={62} fill="#E07A0B" />
      <Ellipse cx={100} cy={104} rx={36} ry={64} fill="#F7922A" />
      <Path d="M80 50c-8 18-8 90 0 112M120 50c8 18 8 90 0 112" stroke="#B85804" strokeWidth={2.5} fill="none" opacity={0.45} />
      <Path d="M62 92l20-16 8 24zM138 92l-20-16-8 24z" fill="#2A1204" />
      <Path d="M66 90l14-11 5 15zM134 90l-14-11-5 15z" fill="#FFCE3A" />
      <Path d="M52 124h22l8-14 12 30 12-24 8 12h34" stroke="#2A1204" strokeWidth={9} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M52 124h22l8-14 12 30 12-24 8 12h34" stroke="#FFCE3A" strokeWidth={3.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export function TreeArt({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.9} viewBox="0 0 200 180">
      <Path d="M100 16l52 60h-24l40 46h-30l32 38H30l32-38H32l40-46H48z" fill="#2E8B57" />
      <Rect x={90} y={160} width={20} height={14} fill="#6B4423" />
      <Path d="M100 4l5 10 11 1-8 7 3 11-11-6-11 6 3-11-8-7 11-1z" fill={ORANGE} />
      <G fill={ORANGE}>
        <Circle cx={82} cy={66} r={5} />
        <Circle cx={118} cy={102} r={5} />
        <Circle cx={74} cy={132} r={5} />
        <Circle cx={130} cy={144} r={5} />
      </G>
      <G fill="#FFFFFF">
        <Circle cx={112} cy={62} r={4} />
        <Circle cx={86} cy={108} r={4} />
        <Circle cx={104} cy={140} r={4} />
      </G>
    </Svg>
  );
}

export function VictoryStarArt({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.9} viewBox="0 0 200 180">
      <Path d="M100 8l24 52 56 6-42 38 12 56-50-30-50 30 12-56-42-38 56-6z" fill={ORANGE} stroke="#FFFFFF" strokeWidth={4} />
      <Path d="M40 166h120" stroke="#FF7A00" strokeWidth={8} />
      <Path d="M40 175h120" stroke="#141414" strokeWidth={7} />
    </Svg>
  );
}
