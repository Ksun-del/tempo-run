/** Safari разрешает говорить только после нажатия — «будим» голос прямо в момент нажатия на СТАРТ */
export function unlockSpeech() {
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis?.speak(u);
  } catch {}
}
