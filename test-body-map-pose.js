#!/usr/bin/env node
'use strict';

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
const poseSrc = fs.readFileSync(path.join(root, 'bodyMapPose.js'), 'utf8');
const bm3 = fs.readFileSync(path.join(root, 'bodyMap3d.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swJs = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'BODY_MAP_3D_MODES.md'), 'utf8');

console.log('=== 1. Module approach + API ===');
assert(poseSrc.includes('segment-based rigid'), 'documents segment-based approach');
assert(poseSrc.includes('NOT full skinning') || poseSrc.includes('not full skinning'), 'rejects full skinning as primary');
assert(poseSrc.includes('POSE_MS = 600') || poseSrc.includes('POSE_MS=600'), '600ms tween');
assert(poseSrc.includes("relaxed") && poseSrc.includes('flex') && poseSrc.includes('slump'), 'home poses');
assert(poseSrc.includes('ready') && poseSrc.includes('victory'), 'live/complete poses');
assert(poseSrc.includes('function classifyMesh'), 'mesh→segment classifier');
assert(poseSrc.includes('function attach'), 'attach builds segment groups');
assert(poseSrc.includes('static pose') || poseSrc.includes('fallback'), 'static fallback documented');
assert(poseSrc.includes('applyFk') && poseSrc.includes('CHAINS'), 'uses bind-pose FK chains');
assert(poseSrc.includes('glow shells stay') || poseSrc.includes('leave meshes parented'), 'keeps meshes parented for glow');

console.log('=== 2. Runtime helpers ===');
const BodyMapPose = new Function(`${poseSrc}; return BodyMapPose;`)();
assert(BodyMapPose.POSE_MS === 600, 'export POSE_MS 600');
assert(BodyMapPose.poseFromColorMode('recovery', 'home-modes') === 'relaxed', 'recovery→relaxed');
assert(BodyMapPose.poseFromColorMode('growth', 'home-modes') === 'flex', 'growth→flex');
assert(BodyMapPose.poseFromColorMode('loss', 'home-modes') === 'slump', 'loss→slump');
assert(BodyMapPose.poseFromColorMode('intensity', 'live') === 'ready', 'live→ready');
assert(BodyMapPose.poseFromColorMode('complete', 'complete') === 'victory', 'complete→victory');
assert(BodyMapPose.classifyMesh({ name: 'biceps_brachii_long_left', userData: { atlasKey: 'biceps_brachii_long' } }) === 'upperArm_L', 'biceps→upperArm_L');
assert(BodyMapPose.classifyMesh({ name: 'deltoid_anterior_right', userData: { atlasKey: 'deltoid_anterior' } }) === 'shoulder_R', 'deltoid→shoulder_R');
assert(BodyMapPose.classifyMesh({ name: 'gastrocnemius_medial_left', userData: { atlasKey: 'gastrocnemius_medial' } }) === 'calf_L', 'calf→calf_L');
assert(BodyMapPose.classifyMesh({ name: 'pectoralis_major_sternocostal', userData: { atlasKey: 'pectoralis_major_sternocostal' } }) === 'torso', 'pec→torso');
assert(BodyMapPose.easeInOut(0) === 0 && BodyMapPose.easeInOut(1) === 1, 'ease endpoints');
assert(Math.abs(BodyMapPose.easeInOut(0.5) - 0.5) < 1e-9, 'ease midpoint');
assert(BodyMapPose.POSES.flex.upperArm_L.z > 80, 'flex raises arms');
assert(BodyMapPose.POSES.victory.upperArm_L.x < -140, 'victory arms up');
assert(BodyMapPose.POSES.slump.torso.x > 12, 'slump bends torso');
assert(poseSrc.includes('matrixAutoUpdate'), 'matrix FK path');

console.log('=== 3. BodyMap3D wiring (no glow/touch regression markers) ===');
assert(bm3.includes('BodyMapPose.attach'), 'mount attaches pose');
assert(bm3.includes('BodyMapPose.update'), 'animate updates pose tween');
assert(bm3.includes('BodyMapPose.dispose'), 'dispose cleans pose');
assert(bm3.includes('applyPoseForState'), 'transition/update apply pose');
assert(bm3.includes('POSE_MS'), 'exports/uses POSE_MS');
assert(bm3.includes('touch-action: pan-y'), 'keeps pan-y touch fix');
assert(bm3.includes('dragAxis'), 'keeps axis lock');
assert(bm3.includes('ensureGlowShells') || bm3.includes('glowShell'), 'keeps glow shells');
assert(bm3.includes('밀어 돌리기'), 'keeps Korean rotate hint');
assert(!/SkinnedMesh/.test(bm3), 'BodyMap3D does not switch to SkinnedMesh');

console.log('=== 4. Wiring / cache ===');
const poseIdx = indexHtml.indexOf('bodyMapPose.js');
const bm3Idx = indexHtml.indexOf('bodyMap3d.js');
assert(poseIdx >= 0 && bm3Idx > poseIdx, 'index loads pose before bodyMap3d');
assert(swJs.includes('bodyMapPose.js'), 'SW caches pose module');
assert(swJs.includes('recovr-cache-v93'), 'SW cache v93');
assert(doc.includes('Stage 3') || doc.includes('Poses (Stage 3)'), 'docs Stage 3');
assert(doc.includes('segment-based'), 'docs explain approach');

console.log(failures === 0 ? '\n=== BodyMapPose tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
