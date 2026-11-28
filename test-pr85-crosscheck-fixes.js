#!/usr/bin/env node
'use strict';

/**
 * Regression for independent cross-check bugs on PR #85:
 * 1) Home must not overwrite recovr_bodymap_view_mode via setPreferredMode
 * 2) Arrow keys on tabs must update Heatmap3dModes state (not only aria)
 * 3) .set-row grid columns must fit 44px check/del without overflow
 */

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures += 1; console.error('FAIL:', msg); }
  else console.log('OK:', msg);
}

const root = __dirname;
const h3d = fs.readFileSync(path.join(root, 'heatmap3dModes.js'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'heatmapModeTabs.js'), 'utf8');
const bm3 = fs.readFileSync(path.join(root, 'bodyMap3d.js'), 'utf8');
const heat = fs.readFileSync(path.join(root, 'muscleHeatmap.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

console.log('=== 1. Home does not write global view-mode pref ===');
assert(!/\.setPreferredMode\s*\(/.test(h3d), 'Heatmap3dModes never calls setPreferredMode(...)');
assert(h3d.includes('resolveHomeMapMode'), 'resolveHomeMapMode present');
assert(/mapMode\s*=\s*webglOk\(\)\s*\?\s*'3d'\s*:\s*'2d'/.test(h3d)
  || (h3d.includes("mapMode = webglOk() ? '3d' : '2d'")),
  'resolveHomeMapMode only sets local mapMode');
assert(h3d.includes('Do NOT call BodyMap3D.setPreferredMode'),
  'documents why global pref is left alone');

// Runtime: mock BodyMap3D + localStorage, ensure afterHomeRender path does not write pref
{
  const store = { recovr_bodymap_view_mode: '2d' };
  const fakeLS = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
  };
  let preferredWrites = 0;
  global.localStorage = fakeLS;
  global.window = global;
  global.document = {
    getElementById() { return null; },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  global.BodyMap3D = {
    isWebGLAvailable() { return true; },
    getPreferredMode() { return store.recovr_bodymap_view_mode || '2d'; },
    setPreferredMode(mode) {
      preferredWrites += 1;
      store.recovr_bodymap_view_mode = mode;
      return mode;
    },
  };
  // Load module (assigns window.Heatmap3dModes)
  // eslint-disable-next-line no-eval
  eval(h3d);
  assert(typeof global.Heatmap3dModes === 'object', 'Heatmap3dModes loaded');
  // afterHomeRender with no host is a no-op for DOM but still runs resolveHomeMapMode
  global.Heatmap3dModes.afterHomeRender({});
  assert(store.recovr_bodymap_view_mode === '2d', 'global pref stays 2d after home render');
  assert(preferredWrites === 0, 'setPreferredMode never invoked from home path');
  assert(global.Heatmap3dModes.getState().mapMode === '3d', 'home local mapMode is 3d when WebGL ok');
  delete global.Heatmap3dModes;
  delete global.BodyMap3D;
  delete global.document;
  delete global.window;
  delete global.localStorage;
}

console.log('=== 2. Keyboard routed to Heatmap3dModes ===');
assert(h3d.includes('onTabKeydown'), 'Heatmap3dModes has keydown handler');
assert(h3d.includes("addEventListener('keydown', onTabKeydown"), 'Heatmap3dModes wires keydown');
assert(tabs.includes('ownsHome3d'), 'HeatmapModeTabs checks ownership');
assert(/onTabKeydown[\s\S]*ownsHome3d[\s\S]*return/.test(tabs), 'keydown early-returns when Modes owns');
assert(/modesOwnsTabs[\s\S]*addEventListener\('keydown'/.test(tabs)
  || /if\s*\(\s*!modesOwnsTabs\s*\)\s*\{[\s\S]*keydown/.test(tabs),
  'HeatmapModeTabs only binds keydown when it owns tabs');

console.log('=== 3. set-row grid fits 44px targets ===');
assert(/\.set-row\s*\{[^}]*grid-template-columns:\s*32px\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+44px\s+44px/.test(indexHtml),
  'set-row columns include 44px check + 44px del');
assert(/\.set-checklist-header\s*\{[^}]*grid-template-columns:\s*32px\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+44px\s+44px/.test(indexHtml),
  'set-checklist-header matches set-row columns');
assert(!/grid-template-columns:\s*32px\s+1fr\s+1fr\s+38px\s+32px/.test(indexHtml),
  'old overflowing 38px/32px grid removed');
assert(/\.set-row input[^}]*min-width:\s*0/.test(indexHtml), 'inputs can shrink inside fr tracks');

console.log('=== 4. Cleanup ===');
assert(!bm3.includes('void rawEvent'), 'no void rawEvent stub');
assert(!/function onPointerDown\(state,\s*e,\s*rawEvent\)/.test(bm3), 'onPointerDown drops unused rawEvent param');
assert(!heat.includes('chrome owns the single home 2D/3D toggle'), 'stale toggle comment removed');
assert(heat.includes('Home is 3D-only'), 'updated home-owns comment');
assert(!bm3.includes('?v=r170'), 'three import has no query (dedupe with GLTFLoader)');
assert(/import\(`\.\/\$\{THREE_URL\}`\)/.test(bm3), 'three imported as bare module URL');
assert(sw.includes('recovr-cache-v99'), 'SW bumped to v90');

console.log(failures === 0 ? '\n=== pr85 crosscheck fixes passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
