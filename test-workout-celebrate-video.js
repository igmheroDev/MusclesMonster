#!/usr/bin/env node
'use strict';
// 운동 완료 축하 영상: 부위 → 장면 매핑 / 장면 선택 / 에셋·SW 연결 검사
const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const W = require('./workoutCelebrateVideo.js');

// 1) KO_LABELS 기준 매핑
const expected = {
  chest: 'chest',
  shoulder: 'shoulders', front_delts: 'shoulders', side_delts: 'shoulders', rear_delts: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  back: 'back', lats: 'back', traps: 'back', lower_back: 'back',
  core: 'abs', abs: 'abs', obliques: 'abs',
  quads: 'legs-front', adductors: 'legs-front',
  glutes: 'legs-back', hamstrings: 'legs-back', calves: 'legs-back',
};
Object.keys(expected).forEach((m) => {
  assert(W.sceneForMuscle(m) === expected[m], `${m} → ${expected[m]} (got ${W.sceneForMuscle(m)})`);
});
assert(W.sceneForMuscle('cardio') === null, 'cardio는 장면 없음');
assert(W.sceneForMuscle('mobility') === null, 'mobility는 장면 없음');

// bodyMap3d KO_LABELS의 모든 키가 장면을 가진다
const bm = fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8');
const koBlock = /const KO_LABELS = \{([\s\S]*?)\};/.exec(bm);
assert(koBlock, 'bodyMap3d KO_LABELS 찾기');
if (koBlock) {
  const keys = [...koBlock[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
  assert(keys.length >= 15, 'KO_LABELS 키 개수');
  keys.forEach((k) => assert(W.sceneForMuscle(k), `KO_LABELS.${k} 장면 매핑 있음`));
}

// 그룹 이름
const labels = W.SCENE_ORDER.map((s) => W.SCENES[s].label);
assert(JSON.stringify(labels) === JSON.stringify(['가슴', '어깨', '팔', '등', '복근', '하체 앞', '하체 뒤']), `그룹 이름 ${labels}`);

// 2) 색 / 포맷
assert(W.colorForPct(1.5) === '#b8ff3d', '1.5% 이상 라임');
assert(W.colorForPct(2.4) === '#b8ff3d', '2.4% 라임');
assert(W.colorForPct(1.4) === '#1aa88a', '1.4% 청록');
assert(W.formatPct(1.84) === '+1.8%', 'formatPct 반올림');
assert(W.formatPct(0.2) === '+0.2%', 'formatPct 0.2');

// 3) pickScene — 성장 데이터 우선
const wk = { date: '2026-11-27', exercises: [{ name: 'x' }] };
const growth = { chest: 0.8, triceps: 1.9, quads: 0.5 };
const growthFn = (_ws, m) => (growth[m] != null ? { growthPct: growth[m] } : null);
let p = W.pickScene(wk, [], { loads: { chest: 10, triceps: 3, quads: 5 }, growthFn });
assert(p && p.scene === 'arms' && p.pct === 1.9 && p.source === 'growth', `최대 성장 부위(삼두→팔) ${JSON.stringify(p)}`);
assert(p && p.label === '팔', '팔 라벨');

// 성장 없음(null/0) → 가장 많이 자극한 부위
p = W.pickScene(wk, [], { loads: { chest: 2, hamstrings: 4, calves: 3 }, growthFn: () => ({ growthPct: 0 }) });
assert(p && p.scene === 'legs-back' && p.pct === null && p.source === 'trained', `가장 많이 자극(하체 뒤) ${JSON.stringify(p)}`);
p = W.pickScene(wk, [], { loads: { back: 2, lats: 1, chest: 2.5 }, growthFn: null });
assert(p && p.scene === 'back', `그룹 합산(등 3 > 가슴 2.5) ${JSON.stringify(p)}`);

// 아무것도 없음 → null
assert(W.pickScene(wk, [], { loads: {}, growthFn }) === null, '자극 없음 → null');
assert(W.pickScene(wk, [], { loads: { cardio: 5 }, growthFn }) === null, '유산소만 → null');
assert(W.pickScene(null, []) === null, 'workout 없음 → null');

// growthFn 예외는 무시
p = W.pickScene(wk, [], { loads: { core: 1 }, growthFn: () => { throw new Error('x'); } });
assert(p && p.scene === 'abs', 'growthFn 예외 → 자극 폴백');

// 기본 경로(ExerciseMuscleMap 전역) 사용
global.ExerciseMuscleMap = { getStimulation: (n) => (n.includes('스쿼트') ? { quads: 3, glutes: 2 } : {}) };
global.getExerciseVolume = (ex) => (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
p = W.pickScene({ date: '2026-11-27', exercises: [{ name: '백 스쿼트', weight: 100, reps: 5, sets: 5 }] }, [], { growthFn: null });
assert(p && p.scene === 'legs-front', `스쿼트 → 하체 앞 ${JSON.stringify(p)}`);
delete global.ExerciseMuscleMap;
delete global.getExerciseVolume;

// 4) 에셋 존재 + SW 캐시 + index.html
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
W.SCENE_ORDER.forEach((s) => {
  ['.mp4', '-poster.jpg'].forEach((ext) => {
    const rel = `assets/celebrate/${s}${ext}`;
    assert(fs.existsSync(path.join(__dirname, rel)), `${rel} 존재`);
    assert(sw.includes(`'./${rel}'`), `sw ASSETS에 ${rel}`);
  });
  assert(W.videoUrl(s) === `assets/celebrate/${s}.mp4`, 'videoUrl');
});
assert(sw.includes("'./workoutCelebrateVideo.js'"), 'sw에 모듈');
assert(/recovr-cache-v(\d+)/.test(sw) && Number(/recovr-cache-v(\d+)/.exec(sw)[1]) >= 97, 'sw 버전 v97+');
assert(sw.includes('206') && sw.includes('Content-Range'), 'sw Range(206) 처리');
assert(html.includes('<script src="workoutCelebrateVideo.js"></script>'), 'index.html 스크립트');
assert(html.indexOf('workoutCelebrateVideo.js') > html.indexOf('muscleGrowthTracker.js'), '성장 모듈 다음에 로드');

// 5) 영상 속성 (muted, playsinline, poster, 건너뛰기)
const src = fs.readFileSync(path.join(__dirname, 'workoutCelebrateVideo.js'), 'utf8');
assert(/<video[^>]*muted[^>]*playsinline/.test(src), 'video muted playsinline');
assert(src.includes('poster="${posterUrl(scene)}"'), 'video poster');
assert(src.includes('건너뛰기') && src.includes('확인'), '건너뛰기/확인 버튼');
assert(src.includes('prefers-reduced-motion'), 'reduced motion 처리');
assert(src.includes('오늘의 성장'), '오늘의 성장 문구');

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('test-workout-celebrate-video: all passed');
