#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const src = fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8');
const modes = fs.readFileSync(path.join(__dirname, 'heatmap3dModes.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');

console.log('=== 1. Glow polish primitives ===');
assert(src.includes('ensureGlowShells'), 'glow shells');
assert(src.includes('glowShellScalesForMesh'), 'scale-aware shell inflation');
assert(src.includes('BackSide'), 'back-face shell');
assert(src.includes('AdditiveBlending'), 'additive halo');
assert(src.includes('sampleFps'), 'FPS sampler');
assert(src.includes('TARGET_FPS = 50') || src.includes('TARGET_FPS=50'), '50fps target');
assert(src.includes('qualityLevel'), 'adaptive quality');
assert(src.includes('findPulseMesh'), 'pulse target');
assert(src.includes('BASE_COLOR = \'#45485a\''), 'visible slate unlit');
assert(src.includes('CONTEXT_COLOR = \'#333544\''), 'context slightly darker than muscle');
assert(src.includes("alpha: true") || src.includes('alpha:true'), 'transparent canvas lets vignette show');
assert(src.includes('scene.background = null'), 'no solid scene background');
assert(src.includes('radial-gradient'), 'CSS vignette background');
assert(/GLOW_SHELL_SCALE = 1\.0(1[0-5]|0\d)/.test(src), 'inner shell constant tight');
assert(/GLOW_SHELL_SCALE_OUTER = 1\.0(2[0-9]|1\d)/.test(src), 'outer shell constant tight');

console.log('=== 2. Growth legend contrast ===');
const BodyMap3D = new Function(
  fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8') + '; return BodyMap3D;'
)();
assert(BodyMap3D.GLOW_SHELL_SCALE <= 1.015, 'inner shell scale tight (≤1.015)');
assert(BodyMap3D.GLOW_SHELL_SCALE_OUTER <= 1.03, 'outer shell scale tight (≤1.03)');
assert(BodyMap3D.GLOW_SHELL_SCALE < BodyMap3D.GLOW_SHELL_SCALE_OUTER, 'outer > inner');
assert(BodyMap3D.GROWTH === '#b8ff3d', 'strong growth lime');
assert(BodyMap3D.GROWTH_DEEP === '#1aa88a', 'growing deep teal');
assert(BodyMap3D.GROWTH !== BodyMap3D.GROWTH_DEEP, 'distinct growth colors');
assert(BodyMap3D.BASE_COLOR === '#45485a', 'exported muscle base');
assert(BodyMap3D.CONTEXT_COLOR === '#333544', 'exported context color');
assert(BodyMap3D.BG === '#07080c', 'exported dark vignette edge');
function lum(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
assert(lum(BodyMap3D.BASE_COLOR) - lum(BodyMap3D.BG) >= 30, 'muscle base clearly brighter than background');
assert(lum(BodyMap3D.BASE_COLOR) > lum(BodyMap3D.CONTEXT_COLOR), 'muscle brighter than head/hands context');
assert(lum(BodyMap3D.CORAL) > lum(BodyMap3D.BASE_COLOR), 'fatigue coral still brighter than idle base');
assert(lum(BodyMap3D.MINT) > lum(BodyMap3D.BASE_COLOR), 'ready mint still brighter than idle base');
const soft = BodyMap3D.growthVisual(0.8, true);
const strong = BodyMap3D.growthVisual(2.5, true);
assert(soft.tier === 'growing', 'low growth tier');
assert(strong.tier === 'strong', 'high growth tier');
assert(soft.color === BodyMap3D.GROWTH_DEEP, 'growing uses deep teal');
assert(strong.color === BodyMap3D.GROWTH, 'strong uses lime');

console.log('=== 3. Quality API ===');
assert(typeof BodyMap3D.getQualityStats === 'function', 'getQualityStats');
assert(BodyMap3D.TARGET_FPS === 50, 'export TARGET_FPS');
assert(BodyMap3D.getQualityStats('missing') === null, 'missing mount → null');

console.log('=== 4. Wiring ===');
assert(modes.includes('GROWTH_DEEP') || modes.includes('#1aa88a'), 'modes legend uses new growing color');
assert(modes.includes('b8ff3d') || modes.includes('GROWTH'), 'modes legend uses strong lime');
assert(sw.includes('recovr-cache-v99'), 'sw cache v90');

console.log(failures === 0 ? '\n=== Glow polish tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
