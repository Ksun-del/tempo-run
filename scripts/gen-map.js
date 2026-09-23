// Встраивает MapLibre GL JS в код, чтобы карта не зависела от CDN.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist');
const js = fs.readFileSync(path.join(dir, 'maplibre-gl.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'maplibre-gl.css'), 'utf8');
const out = `// Сгенерировано scripts/gen-map.js — не редактировать руками.\nexport const MAPLIBRE_JS = ${JSON.stringify(js)};\nexport const MAPLIBRE_CSS = ${JSON.stringify(css)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'mapBundle.ts'), out);
console.log('mapBundle.ts written', out.length);
