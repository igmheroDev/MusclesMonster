#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const store = {};
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
};

const styleStore = {};
function makeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    id: '',
    style: {},
    children: [],
    innerHTML: '',
    textContent: '',
    className: '',
    disabled: false,
    appendChild(child) { this.children.push(child); return child; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) {
        if (force === true) this._s.add(c);
        else if (force === false) this._s.delete(c);
        else if (this._s.has(c)) this._s.delete(c);
        else this._s.add(c);
      },
    },
  };
}

global.document = {
  readyState: 'loading',
  body: makeEl('body'),
  head: { appendChild(el) { styleStore[el.id] = el; return el; } },
  getElementById(id) { return styleStore[id] || null; },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {},
};

global.window = {
  matchMedia() {
    return {
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  },
  devicePixelRatio: 2,
};

const BodyMap3D = new Function(
  fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8') + '; return BodyMap3D;'
)();

assert(typeof BodyMap3D.getPreferredMode === 'function', 'getPreferredMode');
assert(typeof BodyMap3D.setPreferredMode === 'function', 'setPreferredMode');
assert(typeof BodyMap3D.buildModeToggle === 'function', 'buildModeToggle');
assert(typeof BodyMap3D.mount === 'function', 'mount');
assert(typeof BodyMap3D.unmount === 'function', 'unmount');
assert(BodyMap3D.CORAL === '#ff3b5c', 'coral');
assert(BodyMap3D.MINT === '#3ee6b0', 'mint');
assert(BodyMap3D.AMBER === '#f5a524', 'amber');

assert(BodyMap3D.getPreferredMode() === '2d', 'default mode is 2d');
assert(BodyMap3D.setPreferredMode('3d') === '3d', 'set 3d');
assert(BodyMap3D.getPreferredMode() === '3d', 'persist 3d');
assert(BodyMap3D.setPreferredMode('2d') === '2d', 'set 2d');

const required = ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'quads', 'hamstrings', 'adductors', 'calves', 'core', 'forearms'];
required.forEach((id) => {
  assert(BodyMap3D.MUSCLE_IDS.includes(id), `muscle id ${id}`);
  assert(!!BodyMap3D.EN_LABELS[id], `english label ${id}`);
});

assert(BodyMap3D.EN_LABELS.chest === 'Chest', 'Chest label');
assert(BodyMap3D.EN_LABELS.core === 'Abs', 'Abs label');

const html = BodyMap3D.buildModeToggle('2d', { scope: 'test' });
assert(html.includes('data-bm3-mode="2d"'), '2d button');
assert(html.includes('data-bm3-mode="3d"'), '3d button');
assert(html.includes('>2D<'), '2D text');
assert(html.includes('>3D<'), '3D text');
assert(html.includes('selected'), 'selected class');

assert(BodyMap3D.intensityFromLoad(0) === 0, 'zero intensity');
assert(BodyMap3D.intensityFromLoad(1) > 0.2, 'positive intensity');
assert(BodyMap3D.intensityFromLoad(20) <= 1.35, 'intensity capped');

assert(BodyMap3D.recoveryVisual(20, true).color === BodyMap3D.CORAL, 'fatigued coral');
assert(BodyMap3D.recoveryVisual(60, true).color === BodyMap3D.AMBER, 'recovering amber');
assert(BodyMap3D.recoveryVisual(98, true).color === BodyMap3D.MINT, 'ready mint');

const src = fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8');
assert(src.includes('Drag to rotate'), 'english drag hint');
assert(src.includes('vendor/three.module.min.js'), 'vendors three');
assert(src.includes('muscles-body.glb') || src.includes('MODEL_URL'), 'loads anatomy glb');
assert(src.includes('GLTFLoader'), 'uses GLTFLoader');
assert(fs.existsSync(path.join(__dirname, 'vendor/anatomy/muscles-body.glb')), 'anatomy glb exists');
assert(fs.statSync(path.join(__dirname, 'vendor/anatomy/muscles-body.glb')).size < 3 * 1024 * 1024, 'glb under 3MB');
assert(fs.existsSync(path.join(__dirname, 'vendor/anatomy/KEY_TO_APP.json')), 'key map exists');
assert(fs.existsSync(path.join(__dirname, 'vendor/GLTFLoader.js')), 'GLTFLoader vendored');
assert(BodyMap3D.EN_LABELS.traps === 'Traps', 'fine id traps');
assert(BodyMap3D.EN_LABELS.lats === 'Lats', 'fine id lats');
assert(BodyMap3D.EN_LABELS.front_delts === 'Front Delts', 'fine id front delts');
assert(BodyMap3D.EN_LABELS.glutes === 'Glutes', 'fine id glutes');
assert(src.includes('MAX_PIXEL_RATIO = 2') || src.includes('MAX_PIXEL_RATIO=2'), 'pixel ratio cap');
assert(src.includes('dispose'), 'dispose path');
assert(src.includes('WEBGL_lose_context') || src.includes('loseContext'), 'lose context on dispose');
assert(src.includes('showPedestal'), 'complete pedestal support');

assert(fs.existsSync(path.join(__dirname, 'vendor/three.module.min.js')), 'three vendor file');
assert(fs.existsSync(path.join(__dirname, 'vendor/MODEL_SOURCE.md')), 'model source doc');
assert(fs.existsSync(path.join(__dirname, 'vendor/three.LICENSE.txt')), 'three license');

const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(sw.includes('recovr-cache-v83'), 'cache bumped to v82');
assert(sw.includes('bodyMap3d.js'), 'sw caches bodyMap3d');
assert(sw.includes('vendor/three.module.min.js'), 'sw caches three');
assert(sw.includes('vendor/anatomy/muscles-body.glb'), 'sw caches anatomy glb');

const index = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(index.includes('bodyMap3d.js'), 'index loads bodyMap3d');
assert(index.indexOf('bodyMap3d.js') < index.indexOf('bodyMapLive.js'), 'bodyMap3d before live');

const live = fs.readFileSync(path.join(__dirname, 'bodyMapLive.js'), 'utf8');
assert(live.includes('BodyMap3D'), 'live wires BodyMap3D');
assert(live.includes('bm3-mode') || live.includes('buildModeToggle'), 'live has mode toggle');

const heat = fs.readFileSync(path.join(__dirname, 'muscleHeatmap.js'), 'utf8');
assert(heat.includes('BodyMap3D'), 'heatmap wires BodyMap3D');
assert(heat.includes('mh3dHost'), 'heatmap 3d host');

const wcm = fs.readFileSync(path.join(__dirname, 'workoutCompleteMap.js'), 'utf8');
assert(wcm.includes('BodyMap3D'), 'complete wires BodyMap3D');
assert(wcm.includes('showPedestal: true') || wcm.includes('showPedestal:true'), 'complete pedestal');

console.log(failures === 0 ? 'BodyMap3D tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
