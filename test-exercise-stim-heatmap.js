#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

global.MUSCLE_LABELS = {
  chest: { name: '가슴', icon: '🫁' },
  back: { name: '등', icon: '🔵' },
  shoulder: { name: '어깨', icon: '🟡' },
  biceps: { name: '이두', icon: '💪' },
  triceps: { name: '삼두', icon: '🔱' },
  quads: { name: '대퇴사두', icon: '🦵' },
  hamstrings: { name: '둔근/햄스트링', icon: '🍑' },
  adductors: { name: '내전/외전근', icon: '⬡' },
  calves: { name: '종아리', icon: '🦶' },
  core: { name: '코어', icon: '🔶' },
  forearms: { name: '전완', icon: '✊' },
};

global.normalizeExerciseName = (name) => String(name || '').toLowerCase().replace(/\s+/g, '');
global.getMusclesFromExerciseName = (name) => {
  const n = global.normalizeExerciseName(name);
  if (n.includes('벤치') || n.includes('푸시업')) return ['chest', 'triceps', 'shoulder'];
  if (n.includes('스쿼트')) return ['quads', 'hamstrings'];
  if (n.includes('컬') && !n.includes('레그')) return ['biceps'];
  if (n.includes('플랭크')) return ['core'];
  return [];
};
global.getActivityTagsFromExerciseName = () => [];
global.COMMON_EXERCISES = [
  '벤치 프레스', '스쿼트', '덤벨 컬', '플랭크', '랫 풀다운', '레그컬',
];
global.getAllExerciseNames = () => [...global.COMMON_EXERCISES];

const ExerciseMuscleMap = new Function(
  fs.readFileSync(path.join(__dirname, 'exerciseMuscleMap.js'), 'utf8') + '; return ExerciseMuscleMap;'
)();

const bench = ExerciseMuscleMap.getStimulation('벤치 프레스');
assert(bench.chest === 3, 'bench primary chest');
assert(bench.triceps === 2, 'bench secondary triceps');
assert(bench.shoulder === 2, 'bench secondary shoulder');

const squat = ExerciseMuscleMap.getStimulation('스쿼트');
assert(squat.quads === 3, 'squat primary quads');
assert(squat.hamstrings === 2, 'squat secondary hamstrings');

const entries = ExerciseMuscleMap.getStimulationEntries('벤치 프레스');
assert(entries[0].muscle === 'chest', 'entries sorted by level');
assert(entries[0].levelLabel === '주자극', 'primary label');

const chestEx = ExerciseMuscleMap.getExercisesForMuscle('chest');
assert(chestEx.some((e) => e.name === '벤치 프레스'), 'chest includes bench');
assert(chestEx[0].level >= chestEx[chestEx.length - 1].level, 'chest list sorted by level');

const quadsEx = ExerciseMuscleMap.getExercisesForMuscle('quads');
assert(quadsEx.some((e) => e.name === '스쿼트'), 'quads includes squat');

const unknown = ExerciseMuscleMap.getStimulation('알 수 없는 특수운동XYZ');
assert(Object.keys(unknown).length === 0, 'unknown exercise empty stim');

const fallback = ExerciseMuscleMap.getStimulation('와이드 푸시업 변형XYZ');
// keyword fallback via includes('푸시업') in mock — name may not match; use known keyword path
const pushupLike = ExerciseMuscleMap.getStimulation('테스트 푸시업');
assert(pushupLike.chest === 3, 'keyword fallback primary');
assert(pushupLike.triceps === 2, 'keyword fallback secondary');

assert(ExerciseMuscleMap.getLevelColor(3) === 'var(--red)', 'primary color');
assert(ExerciseMuscleMap.getLevelColor(2) === 'var(--orange)', 'secondary color');
assert(ExerciseMuscleMap.getLevelOpacity(3) > ExerciseMuscleMap.getLevelOpacity(1), 'opacity by level');

// UI module: stim svg uses MuscleHeatmap regions
global.MuscleHeatmap = {
  BODY_IMAGES: { front: 'body-map-front.png', back: 'body-map-back.png' },
  BODY_MASKS: { front: 'body-mask-front.png', back: 'body-mask-back.png' },
  FRONT_REGIONS: [
    { muscle: 'chest', d: 'M10 10L20 10L20 20L10 20Z' },
    { muscle: 'quads', d: 'M30 30L40 30L40 40L30 40Z' },
  ],
  BACK_REGIONS: [
    { muscle: 'back', d: 'M10 10L20 10L20 20L10 20Z' },
  ],
  SHORT_NAMES: { chest: '가슴', quads: '대퇴', back: '등' },
  LABEL_POSITIONS: {
    front: { chest: { x: 120, y: 96 }, quads: { x: 92, y: 210 } },
    back: { back: { x: 120, y: 118 } },
  },
  getShortName(k) { return this.SHORT_NAMES[k] || k; },
};

global.document = {
  getElementById() { return null; },
};

const ExerciseStimHeatmap = new Function(
  'ExerciseMuscleMap',
  fs.readFileSync(path.join(__dirname, 'exerciseStimHeatmap.js'), 'utf8') + '; return ExerciseStimHeatmap;'
)(ExerciseMuscleMap);

const svg = ExerciseStimHeatmap.buildStimSvg('front', bench);
assert(svg.includes('esh-svg'), 'stim svg root');
assert(svg.includes('chest'), 'stim svg chest region');
assert(svg.includes('주자극') || svg.includes('esh-region-label'), 'stim svg labels');
assert(svg.includes('body-map-front.png'), 'uses front body image');

const backSvg = ExerciseStimHeatmap.buildStimSvg('back', { back: 3 });
assert(backSvg.includes('body-map-back.png'), 'uses back body image');

console.log(failures === 0 ? 'ExerciseStimHeatmap tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
