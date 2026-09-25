/**
 * Веб-версия (iPhone): рисуем карточку в картинку прямо в браузере
 * и открываем системное меню «Поделиться» — там есть «Сохранить изображение» и Instagram.
 */
import { toBlob } from 'html-to-image';
import type { View } from 'react-native';

export const webShareHint = 'В меню выбери «Сохранить изображение» или Instagram';

async function render(node: View, ratio: number): Promise<File> {
  const el = node as unknown as HTMLElement;
  const width = el.getBoundingClientRect().width || 360;
  const blob = await toBlob(el, { pixelRatio: 1080 / width, cacheBust: true, backgroundColor: '#0B0B0C' });
  if (!blob) throw new Error('не получилось нарисовать картинку');
  const stamp = new Date().toISOString().slice(0, 10);
  void ratio;
  return new File([blob], `RUN-${stamp}.png`, { type: 'image/png' });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function shareOrDownload(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // закрыли меню — ничего страшного
    }
  }
  download(file);
}

export async function saveCard(node: View, ratio: number): Promise<'saved' | 'denied'> {
  await shareOrDownload(await render(node, ratio));
  return 'saved';
}

export async function shareCard(node: View, ratio: number): Promise<'shared' | 'unavailable'> {
  await shareOrDownload(await render(node, ratio));
  return 'shared';
}
