import { DEFAULT_CENTER } from '../lib/config';
import { MAPLIBRE_CSS, MAPLIBRE_JS } from '../lib/mapBundle';

export type MapStyle = 'dark' | 'light';

/** Бесплатные векторные карты OpenFreeMap — без ключей и лимитов */
const STYLES: Record<MapStyle, string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
};

/**
 * HTML-страница с картой MapLibre для WebView.
 * Команды принимает через window.tempo.* (вызывается из React Native через injectJavaScript).
 */
export function buildMapHtml(style: MapStyle, interactive: boolean): string {
  const bg = style === 'dark' ? '#0B0B0C' : '#E9E6DF';
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${MAPLIBRE_CSS}
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${bg};}
.maplibregl-ctrl-attrib{font-size:9px;background:rgba(0,0,0,.35)!important;color:#bbb}
.maplibregl-ctrl-attrib a{color:#ddd}
.maplibregl-ctrl-attrib-button{display:none}
.me{width:18px;height:18px;border-radius:50%;background:#D7FF3A;border:3px solid #0B0B0C;box-shadow:0 0 0 6px rgba(215,255,58,.25)}
.dot{width:12px;height:12px;border-radius:50%;border:2px solid #0B0B0C}
</style></head><body><div id="map"></div>
<script>${MAPLIBRE_JS}</script>
<script>
(function(){
  var interactive = ${interactive ? 'true' : 'false'};
  var BLANK = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '${bg}' } }] };
  var map = new maplibregl.Map({
    container: 'map',
    style: '${STYLES[style]}',
    center: [${DEFAULT_CENTER.lon}, ${DEFAULT_CENTER.lat}],
    zoom: 13,
    interactive: interactive,
    attributionControl: { compact: false, customAttribution: '© OpenFreeMap © OpenStreetMap' },
    pitchWithRotate: false,
    dragRotate: false,
    fadeDuration: 0
  });
  if (interactive) map.touchZoomRotate.disableRotation();

  var segs = [];        // массив отрезков: [[lon,lat],...]
  var curSeg = null;
  var me = null, startM = null, endM = null;
  var follow = true;
  var ready = false;
  var styleOk = false;

  // Если карта не загрузилась (нет интернета) — рисуем трек на пустом фоне
  var fallback = setTimeout(function(){ if (!styleOk) map.setStyle(BLANK); }, 8000);

  function geo(){
    return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: segs.filter(function(s){ return s.length > 1; }) } };
  }
  function install(){
    if (!map.getSource('track')) {
      map.addSource('track', { type: 'geojson', data: geo() });
      map.addLayer({ id: 'track-casing', type: 'line', source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#000', 'line-width': 9, 'line-opacity': 0.35 } });
      map.addLayer({ id: 'track-line', type: 'line', source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#D7FF3A', 'line-width': 5 } });
    }
  }
  function redraw(){ var s = map.getSource('track'); if (s) s.setData(geo()); }
  function dot(color){ var el = document.createElement('div'); el.className = 'dot'; el.style.background = color; return el; }

  map.on('style.load', function(){
    styleOk = styleOk || map.getStyle().layers.length > 1;
    if (styleOk) clearTimeout(fallback);
    install();
    redraw();
    if (!ready) {
      ready = true;
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ready');
      else if (window.parent) window.parent.postMessage('tempo-ready', '*');
    }
  });
  map.on('dragstart', function(){ follow = false; });

  function add(points){
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (curSeg !== p[2] || !segs.length) { segs.push([]); curSeg = p[2]; }
      segs[segs.length - 1].push([p[1], p[0]]);
      if (!startM) startM = new maplibregl.Marker({ element: dot('#2BD47D') }).setLngLat([p[1], p[0]]).addTo(map);
    }
    redraw();
  }
  function clear(){
    segs = []; curSeg = null;
    if (startM) { startM.remove(); startM = null; }
    if (endM) { endM.remove(); endM = null; }
    redraw();
  }
  function bounds(){
    var b = null;
    segs.forEach(function(s){ s.forEach(function(c){
      if (!b) b = new maplibregl.LngLatBounds(c, c); else b.extend(c);
    }); });
    return b;
  }

  window.tempo = {
    setTrack: function(points){ clear(); add(points); },
    append: function(points){ add(points); },
    setMe: function(lat, lon){
      if (!me) { var el = document.createElement('div'); el.className = 'me'; me = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map); }
      else me.setLngLat([lon, lat]);
      if (follow) map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });
    },
    recenter: function(){ follow = true; if (me) map.easeTo({ center: me.getLngLat(), zoom: 16, duration: 600 }); },
    fit: function(pad){
      var b = bounds(); if (!b) return;
      map.fitBounds(b, { padding: pad || 30, animate: false, maxZoom: 17 });
      var last = segs[segs.length - 1]; var c = last && last[last.length - 1];
      if (c && !endM) endM = new maplibregl.Marker({ element: dot('#FF4D4D') }).setLngLat(c).addTo(map);
    }
  };
})();
</script></body></html>`;
}
