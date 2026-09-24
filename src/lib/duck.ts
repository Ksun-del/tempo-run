/**
 * Приглушение чужой музыки (Яндекс Музыка и т.п.), пока звучит подсказка.
 * Android приглушает другие приложения, когда мы «играем» звук с режимом duckOthers,
 * поэтому на время фразы крутим беззвучный файл, а потом отпускаем аудиофокус.
 */
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let ready: Promise<void> | null = null;
let active = 0;

function init() {
  if (!ready) {
    ready = (async () => {
      await setAudioModeAsync({ interruptionMode: 'duckOthers', shouldPlayInBackground: true, playsInSilentMode: true });
      player = createAudioPlayer(require('../../assets/silence.wav'));
      player.loop = true;
      player.volume = 0;
    })().catch(() => {
      ready = null;
    });
  }
  return ready;
}

/** Приглушить музыку (вызывать перед фразой) */
export async function duckStart() {
  active++;
  try {
    await init();
    await setIsAudioActiveAsync(true);
    player?.play();
  } catch {}
}

/** Вернуть громкость (вызывать после фразы) */
export async function duckEnd() {
  active = Math.max(0, active - 1);
  if (active > 0) return;
  try {
    player?.pause();
    await setIsAudioActiveAsync(false); // отдаём аудиофокус — музыка снова громкая
  } catch {}
}
