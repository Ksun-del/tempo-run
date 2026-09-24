import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_REFERER_HOST } from '../lib/config';

export type MapFrameHandle = { run: (js: string) => void };
type Props = { html: string; onReady: () => void; onReload?: () => void };

/** Карта в WebView (Android/iOS). */
const MapFrame = forwardRef<MapFrameHandle, Props>(function MapFrame({ html, onReady, onReload }, ref) {
  const web = useRef<WebView>(null);
  // Если Android выгрузил процесс карты (нехватка памяти), без обработчика падает всё приложение.
  // Вместо этого просто пересоздаём карту.
  const [gen, setGen] = useState(0);
  useImperativeHandle(ref, () => ({
    run: (js: string) => web.current?.injectJavaScript(`try{${js}}catch(e){};true;`),
  }));
  return (
    <WebView
      key={gen}
      ref={web}
      style={StyleSheet.absoluteFill}
      source={{ html, baseUrl: `https://${MAP_REFERER_HOST}/` }}
      originWhitelist={['*']}
      onRenderProcessGone={() => {
        onReload?.();
        setGen((g) => g + 1);
      }}
      onContentProcessDidTerminate={() => {
        onReload?.();
        web.current?.reload();
      }}
      onMessage={(e) => e.nativeEvent.data === 'ready' && onReady()}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
      androidLayerType="hardware"
      containerStyle={{ backgroundColor: 'transparent' }}
    />
  );
});

export default MapFrame;
