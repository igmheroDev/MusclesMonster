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

const EXPECTED_LABELS = [
  '가슴', '어깨', '이두', '삼두', '전완',
  '광배', '승모근', '기립근', '복근', '복사근',
  '대퇴사두', '내전근', '둔근', '햄스트링', '종아리', '유산소',
];

// 1) KO_LABELS 기준 매핑 (개별 근육 장면)
const expected = {
  chest: 'chest',
  shoulder: 'shoulder', front_delts: 'shoulder', side_delts: 'shoulder', rear_delts: 'shoulder',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  back: 'lats', lats: 'lats', traps: 'traps', lower_back: 'lower_back',
  core: 'abs', abs: 'abs', obliques: 'obliques',
  quads: 'quads', adductors: 'adductors',
  glutes: 'glutes', hamstrings: 'hamstrings', calves: 'calves',
};
Object.keys(expected).forEach((m) => {
  assert(W.sceneForMuscle(m) === expected[m], `${m} → ${expected[m]} (got ${W.sceneForMuscle(m)})`);
});
assert(W.sceneForMuscle('cardio') === null, 'cardio는 근육 장면 아님');
assert(W.sceneForMuscle('mobility') === null, 'mobility는 장면 없음');

// back 우산 키: 자극이 큰 세부 부위로
assert(W.sceneForMuscle('back', { traps: 5, lats: 1 }) === 'traps', 'back + 승모근 자극 → traps');
assert(W.sceneForMuscle('back', { lats: 0, lower_back: 2 }) === 'lower_back', 'back + 기립근 자극 → lower_back');

// bodyMap3d KO_LABELS의 모든 키가 장면을 가진다
const bm = fs.readFileSync(path.join(__dirname, 'bodyMap3d.js'), 'utf8');
const koBlock = /const KO_LABELS = \{([\s\S]*?)\};/.exec(bm);
assert(koBlock, 'bodyMap3d KO_LABELS 찾기');
if (koBlock) {
  const keys = [...koBlock[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
  assert(keys.length >= 15, 'KO_LABELS 키 개수');
  keys.forEach((k) => assert(W.sceneForMuscle(k), `KO_LABELS.${k} 장면 매핑 있음`));
}

const labels = W.SCENE_ORDER.map((s) => W.SCENES[s].label);
assert(JSON.stringify(labels) === JSON.stringify(EXPECTED_LABELS), `장면 이름 ${labels}`);
assert(W.SCENE_ORDER.includes('cardio'), 'SCENE_ORDER에 유산소');
assert(W.SCENE_ORDER.length === 16, '장면 16개');

// 2) 색 / 포맷 / 오버레이 문구
assert(W.colorForPct(1.5) === '#b8ff3d', '1.5% 이상 라임');
assert(W.colorForPct(2.4) === '#b8ff3d', '2.4% 라임');
assert(W.colorForPct(1.4) === '#1aa88a', '1.4% 청록');
assert(W.formatPct(1.84) === '+1.8%', 'formatPct 반올림');
assert(W.formatPct(0.2) === '+0.2%', 'formatPct 0.2');
assert(W.formatMinutes(30) === '30분', 'formatMinutes 30');
assert(W.formatMinutes(0) === '0분', 'formatMinutes 0');

let c = W.overlayCopy({ scene: 'chest', label: '가슴', pct: 1.8 });
assert(c && c.kicker === '오늘의 성장' && c.bigText === '가슴 +1.8%' && c.color === '#b8ff3d', `가슴 오버레이 ${JSON.stringify(c)}`);
c = W.overlayCopy({ scene: 'cardio', label: '유산소', minutes: 30 });
assert(c && c.kicker === '오늘의 운동' && c.bigText === '유산소 30분' && c.color === '#1aa88a', `유산소 오버레이 ${JSON.stringify(c)}`);
c = W.overlayCopy({ scene: 'biceps', label: '이두', pct: null });
assert(c && c.kicker === '오늘의 운동' && c.bigText === '이두 완료!', `성장 없는 근육 오버레이 ${JSON.stringify(c)}`);

// 3) pickScene — 개별 근육 성장률 우선
const wk = { date: '2026-11-27', exercises: [{ name: 'x' }] };
const growth = { chest: 0.8, triceps: 1.9, quads: 0.5 };
const growthFn = (_ws, m) => (growth[m] != null ? { growthPct: growth[m] } : null);
let p = W.pickScene(wk, [], { loads: { chest: 10, triceps: 3, quads: 5 }, growthFn });
assert(p && p.scene === 'triceps' && p.pct === 1.9 && p.source === 'growth', `최대 성장 부위(삼두) ${JSON.stringify(p)}`);
assert(p && p.label === '삼두', '삼두 라벨');

// 성장 없음(null/0) → 가장 많이 자극한 개별 부위
p = W.pickScene(wk, [], { loads: { chest: 2, hamstrings: 4, calves: 3 }, growthFn: () => ({ growthPct: 0 }) });
assert(p && p.scene === 'hamstrings' && p.pct === null && p.source === 'trained', `가장 많이 자극(햄스트링) ${JSON.stringify(p)}`);

// back 우산 부하를 세부 부위에 합산 (등 3 > 가슴 2.5)
p = W.pickScene(wk, [], { loads: { back: 2, lats: 1, chest: 2.5 }, growthFn: null });
assert(p && p.scene === 'lats', `등 우산 합산(광배 3 > 가슴 2.5) ${JSON.stringify(p)}`);

// 같은 성장률이면 자극량 큰 쪽
p = W.pickScene(wk, [], {
  loads: { biceps: 2, triceps: 5 },
  growthFn: (_ws, m) => ({ growthPct: 1.2 }),
});
assert(p && p.scene === 'triceps' && p.pct === 1.2, `동점 성장 → 자극량(삼두) ${JSON.stringify(p)}`);

// 아무것도 없음 → null
assert(W.pickScene(wk, [], { loads: {}, growthFn }) === null, '자극 없음 → null');
assert(W.pickScene(wk, [], { loads: { cardio: 5 }, growthFn }) === null, 'loads.cardio만으로는 장면 없음');
assert(W.pickScene(null, []) === null, 'workout 없음 → null');

// 유산소만 (분 있음) → cardio 장면
p = W.pickScene({ date: '2026-11-27', type: 'cardio', duration: 30, exercises: [] }, [], { loads: {}, growthFn: null });
assert(p && p.scene === 'cardio' && p.minutes === 30 && p.source === 'cardio' && p.pct === null, `유산소만 ${JSON.stringify(p)}`);
assert(p && p.label === '유산소', '유산소 라벨');
p = W.pickScene(wk, [], { loads: {}, growthFn: null, cardioMinutes: 20 });
assert(p && p.scene === 'cardio' && p.minutes === 20, `cardioMinutes 옵션 ${JSON.stringify(p)}`);

// 근력+유산소 혼합 → 근력 우선
p = W.pickScene({ date: '2026-11-27', type: 'cardio', duration: 30, exercises: [{ name: 'x' }] }, [], {
  loads: { chest: 4 }, growthFn: null, cardioMinutes: 30,
});
assert(p && p.scene === 'chest' && p.source === 'trained', `혼합 세션은 근력 우선 ${JSON.stringify(p)}`);

// growthFn 예외는 무시
p = W.pickScene(wk, [], { loads: { core: 1 }, growthFn: () => { throw new Error('x'); } });
assert(p && p.scene === 'abs', 'growthFn 예외 → 자극 폴백');

// 기본 경로(ExerciseMuscleMap 전역) 사용
global.ExerciseMuscleMap = { getStimulation: (n) => (n.includes('스쿼트') ? { quads: 3, glutes: 2 } : {}) };
global.getExerciseVolume = (ex) => (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
p = W.pickScene({ date: '2026-11-27', exercises: [{ name: '백 스쿼트', weight: 100, reps: 5, sets: 5 }] }, [], { growthFn: null });
assert(p && p.scene === 'quads', `스쿼트 → 대퇴사두 ${JSON.stringify(p)}`);
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
assert(!sw.includes("assets/celebrate/shoulders.mp4"), '旧 shoulders 에셋 제거');
assert(!sw.includes("assets/celebrate/arms.mp4"), '旧 arms 에셋 제거');
assert(!sw.includes("assets/celebrate/legs-front.mp4"), '旧 legs-front 에셋 제거');
assert(!sw.includes("assets/celebrate/legs-back.mp4"), '旧 legs-back 에셋 제거');
assert(sw.includes("'./workoutCelebrateVideo.js'"), 'sw에 모듈');
assert(/recovr-cache-v(\d+)/.test(sw) && Number(/recovr-cache-v(\d+)/.exec(sw)[1]) >= 98, 'sw 버전 v98+');
assert(sw.includes('206') && sw.includes('Content-Range'), 'sw Range(206) 처리');
assert(html.includes('<script src="workoutCelebrateVideo.js"></script>'), 'index.html 스크립트');
assert(html.indexOf('workoutCelebrateVideo.js') > html.indexOf('muscleGrowthTracker.js'), '성장 모듈 다음에 로드');

// 5) 영상 속성 (muted, playsinline, poster, 건너뛰기)
const src = fs.readFileSync(path.join(__dirname, 'workoutCelebrateVideo.js'), 'utf8');
assert(/<video[^>]*muted[^>]*playsinline/.test(src), 'video muted playsinline');
assert(src.includes('poster="${posterUrl(scene)}"'), 'video poster');
assert(src.includes('건너뛰기') && src.includes('확인'), '건너뛰기/확인 버튼');
assert(src.includes('prefers-reduced-motion'), 'reduced motion 처리');
assert(src.includes('오늘의 성장') && src.includes('오늘의 운동'), '오늘의 성장/운동 문구');

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('test-workout-celebrate-video: all passed');
