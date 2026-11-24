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
assert(src.includes('BackSide'), 'back-face shell');
assert(src.includes('AdditiveBlending'), 'additive halo');
assert(src.includes('sampleFps'), 'FPS sampler');
assert(src.includes('TARGET_FPS = 50') || src.includes('TARGET_FPS=50'), '50fps target');
assert(src.includes('qualityLevel'), 'adaptive quality');
assert(src.includes('findPulseMesh'), 'pulse target');
assert(src.includes('BASE_COLOR = \'#1e1e26\''), 'dark charcoal unlit');

console.log('=== 2. Growth legend contrast ===');
const BodyMap3D = new Function(
  fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8') + '; return BodyMap3D;'
)();
assert(BodyMap3D.GROWTH === '#b8ff3d', 'strong growth lime');
assert(BodyMap3D.GROWTH_DEEP === '#1aa88a', 'growing deep teal');
assert(BodyMap3D.GROWTH !== BodyMap3D.GROWTH_DEEP, 'distinct growth colors');
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
assert(sw.includes('recovr-cache-v93'), 'sw cache v90');

console.log(failures === 0 ? '\n=== Glow polish tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
