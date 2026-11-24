#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const src = fs.readFileSync(path.join(__dirname, 'heatmap3dModes.js'), 'utf8');
const bm3 = fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8');
const doc = fs.readFileSync(path.join(__dirname, 'BODY_MAP_3D_MODES.md'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const heat = fs.readFileSync(path.join(__dirname, 'muscleHeatmap.js'), 'utf8');

console.log('=== 1. Module API surface ===');
assert(src.includes('MOUNT_ID = \'home-modes\''), 'shared mount id');
assert(src.includes('ownsHome3d'), 'ownsHome3d flag');
assert(src.includes('transitionUpdate'), 'uses transitionUpdate');
assert(src.includes('Recovery'), 'Recovery tab label');
assert(src.includes('Growth'), 'Growth tab label');
assert(src.includes('Loss'), 'Loss tab label');
assert(src.includes('h3dSharedHost') || src.includes('SHARED_HOST_ID'), 'shared host');

console.log('=== 2. BodyMap3D growth/loss + transition ===');
assert(bm3.includes('function growthVisual'), 'growthVisual');
assert(bm3.includes('function lossVisual'), 'lossVisual');
assert(bm3.includes('function transitionUpdate'), 'transitionUpdate API');
assert(bm3.includes('TRANSITION_MS = 400') || bm3.includes('TRANSITION_MS=400'), '400ms transition');
assert(bm3.includes('GROWTH = '), 'growth color');
assert(bm3.includes('LOSS = '), 'loss color');
assert(bm3.includes('formatGrowthTip'), 'growth tooltip');
assert(bm3.includes('formatLossTip'), 'loss tooltip');
assert(bm3.includes('colorTransition'), 'animated crossfade');

const BodyMap3D = new Function(
  fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8') + '; return BodyMap3D;'
)();
assert(typeof BodyMap3D.growthVisual === 'function', 'export growthVisual');
assert(typeof BodyMap3D.lossVisual === 'function', 'export lossVisual');
assert(typeof BodyMap3D.transitionUpdate === 'function', 'export transitionUpdate');
assert(BodyMap3D.growthVisual(0, false).albedoMix === 0, 'no growth → idle');
assert(BodyMap3D.growthVisual(2.5, true).albedoMix > 0.5, 'growth mixes mint albedo');
assert(BodyMap3D.lossVisual(4, true).color === BodyMap3D.LOSS || BodyMap3D.lossVisual(4, true).color === BodyMap3D.LOSS_DEEP, 'loss violet');
assert(BodyMap3D.TRANSITION_MS === 400, 'transition ms');

console.log('=== 3. Formulas documented ===');
assert(doc.includes('28 days'), 'growth window documented');
assert(doc.includes('14'), 'loss threshold documented');
assert(doc.includes('MAX_GROWTH_PCT'), 'growth cap documented');
assert(doc.includes('MAX_LOSS_PCT'), 'loss cap documented');
assert(doc.includes('home-modes'), 'shared mount documented');

console.log('=== 4. Wiring ===');
assert(indexHtml.includes('heatmap3dModes.js'), 'index loads module');
assert(indexHtml.includes('h3dSharedHost'), 'shared host in DOM');
assert(indexHtml.includes('data-hmt-mode="loss"'), 'loss tab in DOM');
assert(appJs.includes('Heatmap3dModes.afterHomeRender'), 'app hooks afterHomeRender');
assert(heat.includes('Heatmap3dModes.ownsHome3d'), 'heatmap yields home 3D');
assert(swJs.includes('recovr-cache-v86'), 'sw cache bump');
assert(swJs.includes('heatmap3dModes.js'), 'sw caches module');

console.log(failures === 0 ? '\n=== Heatmap3dModes tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
