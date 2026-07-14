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
assert(MuscleHeatmap.getRecoveryColor(100, false) === MuscleHeatmap.BASE_MUSCLE, 'no data base color');
assert(MuscleHeatmap.BASE_MUSCLE === '#eeeeef', 'base muscle light gray');
assert(MuscleHeatmap.TERRACOTTA === MuscleHeatmap.BASE_MUSCLE, 'terracotta alias');

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
assert(MuscleHeatmap.BODY_SILHOUETTE.front.includes('M120'), 'silhouette path present');
assert(MuscleHeatmap.BODY_IMAGES?.front === 'body-map-front.png', 'front body image');
assert(MuscleHeatmap.BODY_IMAGES?.back === 'body-map-back.png', 'back body image');
assert(MuscleHeatmap.BODY_MASKS?.front === 'body-mask-front.png', 'front body mask');
assert(fs.existsSync(path.join(__dirname, 'body-map-front.png')), 'front png exists');
assert(fs.existsSync(path.join(__dirname, 'body-map-back.png')), 'back png exists');
assert(fs.existsSync(path.join(__dirname, 'body-mask-front.png')), 'front mask exists');
assert(fs.existsSync(path.join(__dirname, 'body-mask-back.png')), 'back mask exists');

assert(typeof MuscleHeatmap.render === 'function', 'render exists');
assert(typeof MuscleHeatmap.setView === 'function', 'setView exists');

assert(MuscleHeatmap.SHORT_NAMES.chest === '가슴', 'short name chest');
assert(MuscleHeatmap.SHORT_NAMES.hamstrings === '햄스', 'short name hamstrings');
assert(MuscleHeatmap.getShortName('quads') === '대퇴', 'getShortName quads');
assert(MuscleHeatmap.LABEL_POSITIONS.front.chest?.x === 120, 'front chest label pos');
assert(MuscleHeatmap.LABEL_POSITIONS.back.back?.y > 0, 'back label pos');
assert(Object.keys(MuscleHeatmap.LABEL_POSITIONS.front).length >= 7, 'front has multiple labels');
assert(Object.keys(MuscleHeatmap.LABEL_POSITIONS.back).length >= 6, 'back has multiple labels');

// DOM 렌더: 근육명 라벨이 SVG에 포함되는지
global.document = {
  getElementById(id) {
    if (id !== 'muscleHeatmapCard') return null;
    const el = {
      innerHTML: '',
      querySelectorAll() { return []; },
      querySelector() { return null; },
    };
    global.__mhCard = el;
    return el;
  },
};
MuscleHeatmap.render({
  chest: { recoveryPct: 72, lastDate: '2026-07-13' },
  back: { recoveryPct: 40, lastDate: '2026-07-12' },
}, ['chest', 'back']);
const html = global.__mhCard.innerHTML;
assert(html.includes('mh-region-label'), 'renders label class');
assert(html.includes('가슴'), 'renders chest name');
assert(html.includes('72%'), 'renders chest pct');
assert(html.includes('mh-labels'), 'labels group outside blend');
assert(html.includes('코어'), 'renders idle core name on front');
assert(html.includes('이두'), 'renders idle biceps name on front');
assert(html.includes('대퇴'), 'renders idle quads short name');

MuscleHeatmap.setView('back');
const backHtml = global.__mhCard.innerHTML;
assert(backHtml.includes('등'), 'renders back name on back view');
assert(backHtml.includes('40%'), 'renders back pct on back view');
assert(backHtml.includes('삼두'), 'renders triceps name on back');
assert(backHtml.includes('햄스'), 'renders hamstrings short name');

console.log(failures === 0 ? 'MuscleHeatmap tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
