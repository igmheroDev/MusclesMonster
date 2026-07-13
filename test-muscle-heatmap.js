#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

global.MUSCLE_LABELS = {
  chest: { name: '가슴' },
  back: { name: '등' },
  shoulder: { name: '어깨' },
  biceps: { name: '이두' },
  triceps: { name: '삼두' },
  quads: { name: '대퇴사두' },
  hamstrings: { name: '둔근/햄스트링' },
  adductors: { name: '내전/외전근' },
  calves: { name: '종아리' },
  core: { name: '코어' },
  forearms: { name: '전완' },
};

global.getPctColor = (pct) => {
  if (pct < 40) return 'var(--red)';
  if (pct < 70) return 'var(--orange)';
  if (pct < 95) return 'var(--yellow)';
  return 'var(--green)';
};

const MuscleHeatmap = new Function(
  fs.readFileSync(path.join(__dirname, 'muscleHeatmap.js'), 'utf8') + '; return MuscleHeatmap;'
)();

assert(MuscleHeatmap.FRONT_REGIONS.length > 0, 'front regions');
assert(MuscleHeatmap.BACK_REGIONS.length > 0, 'back regions');
assert(MuscleHeatmap.getRecoveryColor(30, true) === 'var(--red)', 'red zone');
assert(MuscleHeatmap.getRecoveryColor(50, true) === 'var(--orange)', 'orange zone');
assert(MuscleHeatmap.getRecoveryColor(80, true) === 'var(--yellow)', 'yellow zone');
assert(MuscleHeatmap.getRecoveryColor(99, true) === 'var(--green)', 'green zone');
assert(MuscleHeatmap.getRecoveryColor(100, false).includes('0.08') || MuscleHeatmap.getRecoveryColor(100, false).includes('0.06'), 'no data dim');

const frontMuscles = new Set(MuscleHeatmap.FRONT_REGIONS.map((r) => r.muscle));
assert(frontMuscles.has('chest'), 'front has chest');
assert(frontMuscles.has('quads'), 'front has quads');
assert(frontMuscles.has('core'), 'front has core');
assert(frontMuscles.has('biceps'), 'front has biceps');

const backMuscles = new Set(MuscleHeatmap.BACK_REGIONS.map((r) => r.muscle));
assert(backMuscles.has('back'), 'back has back');
assert(backMuscles.has('hamstrings'), 'back has hamstrings');
assert(backMuscles.has('triceps'), 'back has triceps');

assert(MuscleHeatmap.FRONT_REGIONS.every((r) => typeof r.d === 'string' && r.d.length > 10), 'front regions use path d');
assert(MuscleHeatmap.BACK_REGIONS.every((r) => typeof r.d === 'string' && r.d.length > 10), 'back regions use path d');
assert(typeof MuscleHeatmap.BODY_SILHOUETTE?.front === 'string', 'body silhouette front');
assert(MuscleHeatmap.BODY_SILHOUETTE.front.includes('M100'), 'silhouette starts with head');

assert(typeof MuscleHeatmap.render === 'function', 'render exists');
assert(typeof MuscleHeatmap.setView === 'function', 'setView exists');

console.log(failures === 0 ? 'MuscleHeatmap tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
