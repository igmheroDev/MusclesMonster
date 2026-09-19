#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// ------------------------------------------------------------
// 최소 fake DOM (test-list-quick-actions.js와 동일한 관례)
// ------------------------------------------------------------
function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    children: [],
    parentNode: null,
    _attrs: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); el.className = Array.from(this._set).join(' '); },
      remove(c) { this._set.delete(c); el.className = Array.from(this._set).join(' '); },
      contains(c) { return this._set.has(c); },
    },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html || ''; },
    set(v) { el._html = String(v); },
  });
  return el;
}

const overlay = makeEl('div');
overlay.id = 'prTrendOverlay';

global.document = {
  getElementById(id) {
    if (id === 'prTrendOverlay') return overlay;
    return null;
  },
};

// ------------------------------------------------------------
// 운동 기록 목업: "벤치프레스" 3세션(무게/e1RM/볼륨이 서로 다름)
// ------------------------------------------------------------
const workouts = [
  {
    date: '2025-09-01',
    exercises: [
      { name: '벤치프레스', mode: 'weight', setDetails: [
        { weight: 60, reps: 10, completed: true },
        { weight: 60, reps: 10, completed: true },
      ] },
    ],
  },
  {
    date: '2025-09-08',
    exercises: [
      { name: '벤치프레스', mode: 'weight', setDetails: [
        { weight: 65, reps: 8, completed: true },
        { weight: 65, reps: 8, completed: true },
      ] },
      { name: '스쿼트', mode: 'weight', setDetails: [
        { weight: 100, reps: 5, completed: true },
      ] },
    ],
  },
  {
    date: '2025-09-15',
    exercises: [
      { name: '벤치프레스', mode: 'weight', setDetails: [
        { weight: 70, reps: 5, completed: true },
      ] },
      { name: '런닝', mode: 'duration', durationMin: 30 },
    ],
  },
];

global.getCompletedWorkouts = () => workouts;
global.calcE1RM = (weight, reps) => {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
};
global.getExerciseVolume = (ex) => {
  if (ex.setDetails && ex.setDetails.length > 0) {
    return ex.setDetails.reduce((sum, s) => (s.completed ? sum + (s.weight || 0) * (s.reps || 0) : sum), 0);
  }
  return (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
};

const openExerciseCalls = [];
global.ExerciseStimHeatmap = {
  openExercise(name, opts) { openExerciseCalls.push({ name, opts }); },
};

const PrTrendDetail = new Function(
  fs.readFileSync(path.join(__dirname, 'prTrendDetail.js'), 'utf8') + '; return PrTrendDetail;'
)();

console.log('=== 1. 모듈 API ===');
assert(typeof PrTrendDetail.open === 'function', 'open');
assert(typeof PrTrendDetail.close === 'function', 'close');
assert(typeof PrTrendDetail.closeOnOverlay === 'function', 'closeOnOverlay');
assert(typeof PrTrendDetail.openStim === 'function', 'openStim');
assert(typeof PrTrendDetail.buildSessions === 'function', 'buildSessions');

console.log('=== 2. renderPRList()와 동일한 세션별 최고 무게/e1RM/볼륨 집계 ===');
const sessions = PrTrendDetail.buildSessions('벤치프레스');
assert(sessions.length === 3, '벤치프레스 세션 3건(다른 운동/유산소는 제외)');
assert(sessions[0].date === '2025-09-01', '날짜 오름차순 정렬(가장 오래된 것부터)');
assert(sessions[0].maxWeight === 60, '1회차 최고 무게 60kg');
assert(Math.abs(sessions[0].maxE1RM - 60 * (1 + 10 / 30)) < 0.001, '1회차 e1RM = calcE1RM(60,10)');
assert(sessions[0].volume === 60 * 10 * 2, '1회차 볼륨 = 세트 합산');
assert(sessions[2].maxWeight === 70, '3회차(가장 최근) 최고 무게 70kg — 성장 반영');

console.log('=== 3. 기록 없는 운동은 빈 배열 ===');
assert(PrTrendDetail.buildSessions('없는운동').length === 0, '기록 없는 운동명은 빈 세션');

console.log('=== 4. 시트 HTML: 막대그래프 + 전체 기간 PR 요약 + 자극 부위 보기 버튼 ===');
const html = PrTrendDetail.buildSheetHtml('벤치프레스');
assert(html.includes('벤치프레스'), '운동명 표시');
assert(html.includes('기록 추이'), '기록 추이 문구 포함');
assert(html.includes('최고 무게'), '최고 무게 통계 표시');
assert(html.includes('최고 e1RM'), '최고 e1RM 통계 표시');
assert(html.includes('최고 세션 볼륨'), '최고 세션 볼륨 통계 표시');
assert(html.includes('70'), '전체 기간 최고 무게(70kg)가 반영됨');
assert(html.includes('자극 부위 보기'), '자극 부위 보기 보조 버튼 포함(대체 아닌 추가 동선)');

console.log('=== 5. 기록 없는 운동은 안내 문구만(그래프 없이 에러 없이) ===');
const emptyHtml = PrTrendDetail.buildSheetHtml('없는운동');
assert(emptyHtml.includes('표시할 기록이 없어요'), '빈 상태 안내');

console.log('=== 6. open()/close(): 오버레이에 시트 렌더 및 표시 토글 ===');
PrTrendDetail.open('벤치프레스');
assert(overlay.classList.contains('show'), 'open() 후 show 클래스 부여');
assert(overlay.innerHTML.includes('벤치프레스'), 'open() 후 시트 HTML 렌더됨');
PrTrendDetail.close();
assert(!overlay.classList.contains('show'), 'close() 후 show 클래스 제거');
assert(overlay.innerHTML === '', 'close() 후 내용 비움');

console.log('=== 7. closeOnOverlay(): 오버레이 배경 클릭시에만 닫힘(시트 내부 클릭은 무시) ===');
PrTrendDetail.open('벤치프레스');
PrTrendDetail.closeOnOverlay({ target: { id: 'someOtherEl' } });
assert(overlay.classList.contains('show'), '오버레이 내부(시트) 클릭은 닫지 않음');
PrTrendDetail.closeOnOverlay({ target: { id: 'prTrendOverlay' } });
assert(!overlay.classList.contains('show'), '오버레이 배경 클릭은 닫음');

console.log('=== 8. openStim(): 시트를 닫고 ExerciseStimHeatmap.openExercise 재사용(showAdd:false) ===');
PrTrendDetail.open('벤치프레스');
PrTrendDetail.openStim();
assert(!overlay.classList.contains('show'), 'openStim() 호출 시 기존 시트는 닫힘');
const lastStim = openExerciseCalls[openExerciseCalls.length - 1];
assert(lastStim.name === '벤치프레스', 'openStim() → ExerciseStimHeatmap.openExercise(벤치프레스, ...)');
assert(lastStim.opts && lastStim.opts.showAdd === false, 'showAdd:false로 재사용');

console.log('=== 9. 완성된 모듈은 수정하지 않음(참조/재사용만) ===');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const eshJs = fs.readFileSync(path.join(__dirname, 'exerciseStimHeatmap.js'), 'utf8');
assert(!appJs.includes('PrTrendDetail'), 'app.js는 PrTrendDetail을 참조하지 않음');
assert(!eshJs.includes('PrTrendDetail'), 'exerciseStimHeatmap.js 미참조(읽기 전용 재사용만)');

console.log('=== 10. 정적 연동 검사 (index.html / sw.js) ===');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(indexHtml.includes('<script src="prTrendDetail.js"></script>'), '스크립트 등록');
assert(indexHtml.includes('id="prTrendOverlay"'), '오버레이 등록');
assert(indexHtml.includes('PrTrendDetail.closeOnOverlay(event)'), '오버레이 배경 클릭 핸들러 등록');

const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(swJs.includes("'./prTrendDetail.js'"), 'sw ASSETS 등록');
assert(swJs.includes("'/prTrendDetail.js'"), 'sw NETWORK_FIRST 등록');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
