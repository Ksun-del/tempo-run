import { DEFAULT_CENTER, YANDEX_MAPS_KEY } from '../lib/config';
import { MAPLIBRE_CSS, MAPLIBRE_JS } from '../lib/mapBundle';

export type MapStyle = 'dark' | 'light';

/** Запасные карты OpenFreeMap (если Яндекс не загрузился) */
const STYLES: Record<MapStyle, string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
};

const TRACK = '#FFB902';

/**
 * HTML-страница с картой для WebView.
 * Сначала пробуем Яндекс Карты (JS API 3.0), если за 8 с не получилось — MapLibre + OpenFreeMap,
 * а если и он не загрузил стиль — трек на пустом фоне.
 * Снаружи управляется одинаково: window.tempo.setTrack/append/setMe/recenter/fit.
 */
export function buildMapHtml(style: MapStyle, interactive: boolean): string {
  const dark = style === 'dark';
  const bg = dark ? '#0B0B0C' : '#E9E6DF';
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${MAPLIBRE_CSS}
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${bg};overflow:hidden}
.maplibregl-ctrl-attrib{font-size:9px;background:rgba(0,0,0,.35)!important;color:#bbb}
.maplibregl-ctrl-attrib a{color:#ddd}
.maplibregl-ctrl-attrib-button{display:none}
.me{width:18px;height:18px;border-radius:50%;background:${TRACK};border:3px solid #0B0B0C;box-shadow:0 0 0 6px rgba(255,185,2,.28);transform:translate(-50%,-50%)}
.dot{width:12px;height:12px;border-radius:50%;border:2px solid #0B0B0C;transform:translate(-50%,-50%)}
.maplibregl-marker .me,.maplibregl-marker .dot{transform:none}
</style></head><body><div id="map"></div>
<script>${MAPLIBRE_JS}</script>
<script>
(function(){
  var interactive = ${interactive ? 'true' : 'false'};
  var DARK = ${dark ? 'true' : 'false'};
  var CENTER = [${DEFAULT_CENTER.lon}, ${DEFAULT_CENTER.lat}];
  var el = document.getElementById('map');

  // ---- общее состояние трека ----
  var segs = [], curSeg = null, meC = null, follow = true, engine = null, started = false;
  var startC = null, endC = null;
  el.addEventListener('touchstart', function(){ follow = false; }, { passive: true });

  function lines(){ return segs.filter(function(s){ return s.length > 1; }); }
  function dotEl(color){ var d = document.createElement('div'); d.className = 'dot'; d.style.background = color; return d; }
  function meEl(){ var d = document.createElement('div'); d.className = 'me'; return d; }
  function bbox(){
    var b = null;
    segs.forEach(function(s){ s.forEach(function(c){
      if (!b) b = [c[0], c[1], c[0], c[1]];
      else { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); }
    }); });
    return b;
  }
  function sayReady(){
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ready');
    else if (window.parent) window.parent.postMessage('tempo-ready', '*');
  }

  // ---- Яндекс Карты ----
  function yandexEngine(){
    var Y = window.ymaps3;
    var map = new Y.YMap(el, {
      location: { center: CENTER, zoom: 13 },
      theme: DARK ? 'dark' : 'light',
      behaviors: interactive ? ['drag', 'pinchZoom', 'scrollZoom', 'dblClick'] : []
    });
    map.addChild(new Y.YMapDefaultSchemeLayer({ theme: DARK ? 'dark' : 'light' }));
    map.addChild(new Y.YMapDefaultFeaturesLayer({}));
    var casing = null, line = null, me = null, sm = null, em = null;
    function geom(){ return { type: 'MultiLineString', coordinates: lines() }; }
    return {
      redraw: function(){
        var ls = lines();
        if (!ls.length) {
          if (line) { map.removeChild(line); map.removeChild(casing); line = casing = null; }
        } else if (!line) {
          casing = new Y.YMapFeature({ geometry: geom(), style: { stroke: [{ color: 'rgba(0,0,0,0.35)', width: 9 }] } });
          line = new Y.YMapFeature({ geometry: geom(), style: { stroke: [{ color: '${TRACK}', width: 5 }] } });
          map.addChild(casing); map.addChild(line);
        } else {
          casing.update({ geometry: geom() }); line.update({ geometry: geom() });
        }
        if (startC && !sm) { sm = new Y.YMapMarker({ coordinates: startC }, dotEl('#2BD47D')); map.addChild(sm); }
        if (!startC && sm) { map.removeChild(sm); sm = null; }
        if (endC && !em) { em = new Y.YMapMarker({ coordinates: endC }, dotEl('#FF4D4D')); map.addChild(em); }
        if (!endC && em) { map.removeChild(em); em = null; }
      },
      me: function(c){
        if (!me) { me = new Y.YMapMarker({ coordinates: c }, meEl()); map.addChild(me); }
        else me.update({ coordinates: c });
      },
      center: function(c, minZoom){ map.update({ location: { center: c, zoom: Math.max(map.zoom || 13, minZoom), duration: 600 } }); },
      fit: function(b, pad){
        map.update({ margin: [pad, pad, pad, pad], location: { bounds: [[b[0], b[3]], [b[2], b[1]]], duration: 0 } });
        if (map.zoom > 17) map.update({ location: { center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], zoom: 17, duration: 0 } });
      }
    };
  }

  // ---- запасной вариант: MapLibre ----
  function maplibreEngine(onReady){
    var BLANK = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '${bg}' } }] };
    var map = new maplibregl.Map({
      container: 'map', style: '${STYLES[style]}', center: CENTER, zoom: 13,
      interactive: interactive,
      attributionControl: { compact: false, customAttribution: '© OpenFreeMap © OpenStreetMap' },
      pitchWithRotate: false, dragRotate: false, fadeDuration: 0
    });
    if (interactive) map.touchZoomRotate.disableRotation();
    var styleOk = false, first = true, me = null, sm = null, em = null;
    var fb = setTimeout(function(){ if (!styleOk) map.setStyle(BLANK); }, 8000);
    function data(){ return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines() } }; }
    var api = {
      redraw: function(){
        var s = map.getSource('track'); if (s) s.setData(data());
        if (startC && !sm) sm = new maplibregl.Marker({ element: dotEl('#2BD47D') }).setLngLat(startC).addTo(map);
        if (!startC && sm) { sm.remove(); sm = null; }
        if (endC && !em) em = new maplibregl.Marker({ element: dotEl('#FF4D4D') }).setLngLat(endC).addTo(map);
        if (!endC && em) { em.remove(); em = null; }
      },
      me: function(c){ if (!me) me = new maplibregl.Marker({ element: meEl() }).setLngLat(c).addTo(map); else me.setLngLat(c); },
      center: function(c, minZoom){ map.easeTo({ center: c, zoom: Math.max(map.getZoom(), minZoom), duration: 600 }); },
      fit: function(b, pad){ map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad, animate: false, maxZoom: 17 }); }
    };
    map.on('style.load', function(){
      styleOk = styleOk || map.getStyle().layers.length > 1;
      if (styleOk) clearTimeout(fb);
      if (!map.getSource('track')) {
        map.addSource('track', { type: 'geojson', data: data() });
        map.addLayer({ id: 'track-casing', type: 'line', source: 'track', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': 9, 'line-opacity': 0.35 } });
        map.addLayer({ id: 'track-line', type: 'line', source: 'track', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '${TRACK}', 'line-width': 5 } });
      }
      api.redraw();
      if (first) { first = false; onReady(api); }
    });
    return api;
  }

  function use(api){
    if (started) return;
    started = true; engine = api;
    engine.redraw();
    if (meC) engine.me(meC);
    sayReady();
  }

  function tryYandex(){
    var done = false;
    function fail(){ if (done) return; done = true; maplibreEngine(use); }
    var timer = setTimeout(fail, 8000);
    var s = document.createElement('script');
    s.src = 'https://api-maps.yandex.ru/v3/?apikey=${YANDEX_MAPS_KEY}&lang=ru_RU';
    s.onerror = function(){ clearTimeout(timer); fail(); };
    s.onload = function(){
      if (!window.ymaps3) { clearTimeout(timer); fail(); return; }
      window.ymaps3.ready.then(function(){
        if (done) return;
        try { var api = yandexEngine(); done = true; clearTimeout(timer); use(api); }
        catch (e) { clearTimeout(timer); fail(); }
      }, function(){ clearTimeout(timer); fail(); });
    };
    document.head.appendChild(s);
  }
  tryYandex();

  function add(points){
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (curSeg !== p[2] || !segs.length) { segs.push([]); curSeg = p[2]; }
      var c = [p[1], p[0]];
      segs[segs.length - 1].push(c);
      if (!startC) startC = c;
    }
    if (engine) engine.redraw();
  }

  window.tempo = {
    setTrack: function(points){ segs = []; curSeg = null; startC = null; endC = null; add(points); },
    append: function(points){ add(points); },
    setMe: function(lat, lon){
      meC = [lon, lat];
      if (!engine) return;
      engine.me(meC);
      if (follow) engine.center(meC, 16);
    },
    recenter: function(){ follow = true; if (engine && meC) engine.center(meC, 16); },
    fit: function(pad){
      var b = bbox(); if (!b || !engine) return;
      var last = segs[segs.length - 1]; endC = last && last[last.length - 1];
      engine.redraw();
      engine.fit(b, pad || 30);
    }
  };
})();
</script></body></html>`;
}
