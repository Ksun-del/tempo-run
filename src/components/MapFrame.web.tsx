import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type MapFrameHandle = { run: (js: string) => void };
type Props = { html: string; onReady: () => void; onReload?: () => void };

/** Веб-версия карты (для предпросмотра в браузере). */
const MapFrame = forwardRef<MapFrameHandle, Props>(function MapFrame({ html, onReady }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  useImperativeHandle(ref, () => ({
    run: (js: string) => {
      const w = frame.current?.contentWindow as (Window & { eval: (s: string) => void }) | null;
      try {
        w?.eval(js);
      } catch {}
    },
  }));
  useEffect(() => {
    const h = (e: MessageEvent) => e.data === 'tempo-ready' && e.source === frame.current?.contentWindow && onReady();
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [onReady]);
  return createElement('iframe', {
    ref: frame,
    srcDoc: html,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
  });
});

export default MapFrame;
