/**
 * Карточка тренировки = фон (фото или градиент) + стикеры, которые можно двигать и масштабировать.
 * Координаты стикеров — доли ширины/высоты карточки от выбранного угла, поэтому карточка
 * одинаково выглядит в превью, в редакторе и в картинке 1080 px.
 */

export type Format = 'story' | 'post';
export const RATIO: Record<Format, number> = { story: 16 / 9, post: 5 / 4 };

export type StickerKind =
  | 'logo1'
  | 'logo2'
  | 'date'
  | 'title'
  | 'distance'
  | 'time'
  | 'pace'
  | 'stats'
  | 'pills'
  | 'route'
  | 'bigkm'
  | 'classic'
  | 'splits'
  | 'text';

export type Anchor = 'tl' | 'tr' | 'bl' | 'br';
export type Tint = 'accent' | 'white';

export type Sticker = {
  id: string;
  kind: StickerKind;
  anchor: Anchor;
  /** отступ от угла anchor, доля ширины карточки */
  x: number;
  /** отступ от угла anchor, доля высоты карточки */
  y: number;
  scale: number;
  tint: Tint;
  text?: string;
};

export type Shade = 'none' | 'bottom' | 'full';

export type Composition = {
  format: Format;
  photo: string | null;
  shade: Shade;
  stickers: Sticker[];
  set: SetId | null;
};

export const ACCENT = '#FFB900';
export const tintColor = (t: Tint) => (t === 'accent' ? ACCENT : '#FFFFFF');

let seq = 0;
export const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Стикеры, которые можно добавить по одному */
export const STICKER_MENU: { kind: StickerKind; label: string }[] = [
  { kind: 'logo1', label: 'Логотип 1' },
  { kind: 'logo2', label: 'Логотип 2' },
  { kind: 'distance', label: 'Километры' },
  { kind: 'time', label: 'Время' },
  { kind: 'pace', label: 'Темп' },
  { kind: 'stats', label: 'Все цифры' },
  { kind: 'pills', label: 'Цифры в облачках' },
  { kind: 'route', label: 'Маршрут' },
  { kind: 'date', label: 'Дата' },
  { kind: 'title', label: 'Название' },
  { kind: 'bigkm', label: 'Крупные км' },
  { kind: 'splits', label: 'Сплиты' },
];

/** Какой цвет стикер получает по умолчанию */
const DEFAULT_TINT: Partial<Record<StickerKind, Tint>> = { distance: 'accent', route: 'accent', bigkm: 'accent', classic: 'accent', pills: 'accent', splits: 'accent' };

/** Новый одиночный стикер — появляется примерно в центре */
export function makeSticker(kind: StickerKind, text?: string): Sticker {
  return { id: newId(), kind, anchor: 'tl', x: 0.22, y: 0.4, scale: 1, tint: DEFAULT_TINT[kind] ?? 'white', text };
}

export type SetId = 'digits' | 'big' | 'classic' | 'route' | 'splits' | 'logo';

export const SETS: { id: SetId; name: string }[] = [
  { id: 'digits', name: 'Цифры' },
  { id: 'big', name: 'Километры' },
  { id: 'classic', name: 'Классика' },
  { id: 'route', name: 'Маршрут' },
  { id: 'splits', name: 'Сплиты' },
  { id: 'logo', name: 'Только логотип' },
];

/**
 * Наборы — готовые раскладки стикеров. Размеры заданы в «единицах»: ширина карточки = 360.
 */
export function makeSet(id: SetId, format: Format): { stickers: Sticker[]; shade: Shade } {
  const W = 360;
  const H = 360 * RATIO[format];
  const at = (kind: StickerKind, anchor: Anchor, ux: number, uy: number, extra: Partial<Sticker> = {}): Sticker => ({
    id: newId(),
    kind,
    anchor,
    x: ux / W,
    y: uy / H,
    scale: 1,
    tint: DEFAULT_TINT[kind] ?? 'white',
    ...extra,
  });
  switch (id) {
    case 'digits':
      return {
        shade: 'none',
        stickers: [at('logo1', 'tl', 20, 20), at('date', 'tl', 22, 92), at('route', 'tr', 18, 18, { scale: 0.8 }), at('pills', 'bl', 18, 20)],
      };
    case 'big':
      return { shade: 'bottom', stickers: [at('logo1', 'tl', 20, 20), at('date', 'tr', 20, 24), at('bigkm', 'bl', 22, 22)] };
    case 'classic':
      return {
        shade: 'bottom',
        stickers: [at('logo1', 'tl', 20, 20, { scale: 1.1 }), at('date', 'tl', 22, 100), at('route', 'tr', 18, 18, { scale: 0.9 }), at('classic', 'bl', 20, 22)],
      };
    case 'route':
      return {
        shade: 'bottom',
        stickers: [at('logo1', 'tl', 20, 20), at('date', 'tr', 20, 24), at('route', 'br', 18, 110, { scale: 1.25 }), at('stats', 'bl', 20, 22)],
      };
    case 'splits':
      return { shade: 'full', stickers: [at('logo1', 'tl', 20, 20), at('route', 'tr', 18, 18, { scale: 0.8 }), at('splits', 'bl', 22, 22)] };
    case 'logo':
      return { shade: 'none', stickers: [at('logo1', 'tl', 20, 20)] };
  }
}

export function defaultComposition(format: Format = 'story'): Composition {
  return { format, photo: null, set: 'digits', ...makeSet('digits', format) };
}

/** Данные пробежки для карточки */
export type CardData = {
  title: string;
  startedAt: number;
  distanceM: number;
  durationMs: number;
  pace: number | null;
  elevationGainM: number;
  points: import('../../lib/geo').TrackPoint[];
  splits: { km: string; pace: number }[];
  name: string;
};
