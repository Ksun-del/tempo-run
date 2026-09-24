import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_REFERER_HOST } from '../lib/config';

export type MapFrameHandle = { run: (js: string) => void };
type Props = { html: string; onReady: () => void };

/** Карта в WebView (Android/iOS). */
const MapFrame = forwardRef<MapFrameHandle, Props>(function MapFrame({ html, onReady }, ref) {
  const web = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({
    run: (js: string) => web.current?.injectJavaScript(`try{${js}}catch(e){};true;`),
  }));
  return (
    <WebView
      ref={web}
      style={StyleSheet.absoluteFill}
      source={{ html, baseUrl: `https://${MAP_REFERER_HOST}/` }}
      originWhitelist={['*']}
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
