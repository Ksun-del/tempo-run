import { memo, useMemo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { projectTrack, simplify, type TrackPoint } from '../lib/geo';

type Props = {
  points: TrackPoint[];
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
  padding?: number;
  shadow?: boolean;
  dots?: boolean;
};

/** Силуэт маршрута без карты — для карточек и списка. */
function TrackSvg({ points, width, height, color = '#FFB900', strokeWidth = 4, padding, shadow, dots = true }: Props) {
  const proj = useMemo(
    () => projectTrack(simplify(points, 800), width, height, padding ?? strokeWidth * 2 + 4),
    [points, width, height, padding, strokeWidth],
  );
  if (!proj.paths.length) return <Svg width={width} height={height} />;
  return (
    <Svg width={width} height={height}>
      {shadow &&
        proj.paths.map((d, i) => (
          <Path
            key={`s${i}`}
            d={d}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={strokeWidth + 4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      {proj.paths.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {dots && proj.start && (
        <Circle cx={proj.start[0]} cy={proj.start[1]} r={strokeWidth * 0.9 + 1} fill={color} stroke="#0B0B0C" strokeWidth={1.5} />
      )}
      {dots && proj.end && (
        <Circle cx={proj.end[0]} cy={proj.end[1]} r={strokeWidth * 0.9 + 1} fill="#0B0B0C" stroke={color} strokeWidth={2} />
      )}
    </Svg>
  );
}

export default memo(TrackSvg);
