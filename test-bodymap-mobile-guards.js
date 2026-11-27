#!/usr/bin/env node
'use strict';

/**
 * Source-level guards for mobile touch / duplicate UI regressions
 * introduced around the 3D body-map PRs.
 */

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

const root = __dirname;
const bm3 = fs.readFileSync(path.join(root, 'bodyMap3d.js'), 'utf8');
const h3d = fs.readFileSync(path.join(root, 'heatmap3dModes.js'), 'utf8');
const heat = fs.readFileSync(path.join(root, 'muscleHeatmap.js'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'heatmapModeTabs.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert(/touch-action:\s*pan-y/.test(bm3), 'bm3-stage uses touch-action:pan-y (not none)');
assert(!/touch-action:\s*none/.test(bm3), 'bodyMap3d must not set touch-action:none');
assert(bm3.includes('dragAxis'), 'axis lock for rotate vs scroll');
assert(bm3.includes('AXIS_LOCK_PX'), 'axis lock threshold constant');
assert(bm3.includes('PointerEvent'), 'prefer PointerEvent path');
assert(bm3.includes('usePointer'), 'PointerEvent vs legacy touch gated by usePointer');
assert(
  /if\s*\(\s*usePointer\s*\)\s*\{[\s\S]*?return;\s*\}[\s\S]*touchstart/.test(bm3),
  'touch* listeners only in legacy fallback after PointerEvent return'
);
assert(bm3.includes("dataset.bm3Bound"), 'mode toggle re-bind guard');
assert(bm3.includes('pointer-events: none !important'), 'hidden hosts cannot intercept taps');

assert(h3d.includes('.bm3-mode-toggle'), 'hides all home mode toggles');
assert(h3d.includes('touch-action: pan-y'), 'shared 3D host allows vertical pan');
assert(h3d.includes('#muscleHeatmapCard'), 'hides 2D cards while 3D active');
assert(h3d.includes('resolveHomeMapMode') || h3d.includes('webglOk'), 'home is 3D-only with WebGL gate');
assert(!/buildModeToggle\(mapMode/.test(h3d), 'home chrome has no 2D/3D toggle builder');
assert(h3d.includes('회복') && h3d.includes('성장') && h3d.includes('손실'), 'Korean mode tabs');
assert(h3d.includes('stopPropagation'), 'tab click stopPropagation vs HeatmapModeTabs');

assert(heat.includes('ownsHome3d'), 'recovery heatmap yields home 3D to Heatmap3dModes');
assert(heat.includes("scope: 'recovery'") || heat.includes('scope: "recovery"'), 'recovery scope still defined for non-home');

assert(tabs.includes('ownsHome3d'), 'HeatmapModeTabs defers to Heatmap3dModes');
assert(sw.includes('recovr-cache-v97'), 'SW cache bumped to v90');

console.log(failures === 0 ? '\n=== bodymap mobile guards passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
