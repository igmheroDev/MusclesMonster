#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// ------------------------------------------------------------
// 최소 fake DOM (test-list-quick-actions.js / test-cardio-list-quick-actions.js와 동일한 관례)
// ------------------------------------------------------------
const registeredById = new Map();

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    children: [],
    parentNode: null,
    _attrs: {},
    _listeners: [],
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); el.className = Array.from(this._set).join(' '); },
      remove(c) { this._set.delete(c); el.className = Array.from(this._set).join(' '); },
      contains(c) { return this._set.has(c); },
    },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    addEventListener(type, fn) { this._listeners.push([type, fn]); },
    scrollIntoView() { el._scrolledIntoView = true; },
  };
  return el;
}

function setId(el, id) {
  el.id = id;
  registeredById.set(id, el);
  return el;
}

function fire(el, type, target) {
  el._listeners.filter((l) => l[0] === type).forEach((l) => {
    l[1]({ target: target || el, preventDefault() {} });
  });
}

function fireKey(el, type, target, key) {
  el._listeners.filter((l) => l[0] === type).forEach((l) => {
    l[1]({ target: target || el, preventDefault() {}, key });
  });
}

const head = makeEl('head');
const createdElements = [];

// ------------------------------------------------------------
// "최근 추세" (#trendChart) 목업 — 완료 8세션(볼륨 그래프), 진행중 기록도 섞음
// ------------------------------------------------------------
function makeBarWrap(count) {
  const wrap = makeEl('div');
  for (let i = 0; i < count; i++) wrap.appendChild(makeEl('div'));
  return wrap;
}

const trendChart = setId(makeEl('div'), 'trendChart');
trendChart.appendChild(makeBarWrap(8));

const cardioTrendChart = setId(makeEl('div'), 'cardioTrendChart');
cardioTrendChart.appendChild(makeBarWrap(2));

global.document = {
  readyState: 'complete',
  head,
  documentElement: makeEl('html'),
  getElementById(id) {
    return registeredById.get(id) || createdElements.find((e) => e.id === id) || null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    createdElements.push(el);
    return el;
  },
  addEventListener() {},
};

// ------------------------------------------------------------
// 운동 기록 목업(loadWorkouts 원본 순서 = 그대로 실제 저장 순서라고 가정).
// 진행중(inProgress) 기록을 완료 기록들 사이에 섞어서, "완료 기록에서의
// k번째"와 "원본 배열에서의 실제 인덱스"가 달라지는 상황을 검증한다.
// ------------------------------------------------------------
const rawWorkouts = [
  { date: '2025-08-01', type: 'upper', exercises: [{ name: '벤치프레스' }] },       // idx 0 (completed 0)
  { date: '2025-08-03', type: 'cardio', exercises: [{ name: '런닝' }] },            // idx 1 (completed 1, cardio)
  { date: '2025-08-05', inProgress: true, exercises: [] },                          // idx 2 (진행중, 제외)
  { date: '2025-08-08', type: 'lower', exercises: [{ name: '스쿼트' }] },           // idx 3 (completed 2)
  { date: '2025-08-10', type: 'cardio', exercises: [{ name: '자전거' }] },          // idx 4 (completed 3, cardio)
  { date: '2025-08-12', type: 'upper', exercises: [{ name: '오버헤드프레스' }] },   // idx 5 (completed 4)
  { date: '2025-08-15', type: 'full', exercises: [{ name: '데드리프트' }] },        // idx 6 (completed 5)
  { date: '2025-08-18', inProgress: true, exercises: [] },                          // idx 7 (진행중, 제외)
  { date: '2025-08-20', type: 'lower', exercises: [{ name: '레그프레스' }] },       // idx 8 (completed 6)
  { date: '2025-08-22', type: 'upper', exercises: [{ name: '풀업' }] },             // idx 9 (completed 7)
];

global.loadWorkouts = () => rawWorkouts;
global.getCompletedWorkouts = () => rawWorkouts.filter((w) => !w.inProgress);
global.getExerciseVolume = () => 100;

global.CardioTracker = {
  isCardioWorkout(w) { return !!w && w.type === 'cardio'; },
};

// ------------------------------------------------------------
// switchView / setLogTab 스파이
// ------------------------------------------------------------
const switchViewCalls = [];
const setLogTabCalls = [];
global.switchView = (v) => switchViewCalls.push(v);
global.setLogTab = (m) => setLogTabCalls.push(m);

// ------------------------------------------------------------
// LogList 목업: PAGE_SIZE=3으로 두어 loadMore()가 여러 번 필요한 상황을 재현.
// sortWithIndex는 실제 모듈과 동일한 규칙(날짜 내림차순, 원본 idx 보존)으로 계산.
// ------------------------------------------------------------
const LOG_PAGE_SIZE = 3;
let visibleCount = LOG_PAGE_SIZE;
const toggleDetailCalls = [];

function logListSortWithIndex(workouts) {
  return (workouts || [])
    .map((w, idx) => ({ w, idx }))
    .sort((a, b) => new Date(b.w.date) - new Date(a.w.date));
}

function renderVisibleItems() {
  const sorted = logListSortWithIndex(rawWorkouts);
  const page = sorted.slice(0, visibleCount);
  page.forEach(({ idx }) => {
    if (!registeredById.has(`wi-${idx}`)) {
      const item = makeEl('div');
      setId(item, `wi-${idx}`);
      const panel = makeEl('div');
      setId(panel, `wp-${idx}`);
      registeredById.set(`wi-${idx}`, item);
      registeredById.set(`wp-${idx}`, panel);
    }
  });
}

global.LogList = {
  sortWithIndex: logListSortWithIndex,
  getVisibleCount() { return visibleCount; },
  loadMore() {
    visibleCount += LOG_PAGE_SIZE;
    renderVisibleItems();
  },
  toggleDetail(panelId, itemId) { toggleDetailCalls.push({ panelId, itemId }); },
};
renderVisibleItems(); // 초기 렌더(첫 페이지)

// setTimeout을 큐로 만들어 하이라이트 제거 타이밍을 직접 통제한다.
const timeoutQueue = [];
global.setTimeout = (fn) => { timeoutQueue.push(fn); return timeoutQueue.length; };

const TrendChartQuickActions = new Function(
  fs.readFileSync(path.join(__dirname, 'trendChartQuickActions.js'), 'utf8') + '; return TrendChartQuickActions;'
)();

console.log('=== 1. 모듈 API ===');
assert(typeof TrendChartQuickActions.init === 'function', 'init');
assert(typeof TrendChartQuickActions.buildSortedForContainer === 'function', 'buildSortedForContainer');
assert(typeof TrendChartQuickActions.completedIndexToRawIndex === 'function', 'completedIndexToRawIndex');

console.log('=== 2. "최근 추세" 정렬 규칙 = app.js renderTrendChart와 동일(오름차순, 최근 8개) ===');
const completed = global.getCompletedWorkouts();
const mainSorted = TrendChartQuickActions.buildSortedForContainer('trendChart', completed);
assert(mainSorted.length === 8, '완료 기록 8건 모두 표시(8개 이하라 slice(-8) 영향 없음)');
assert(mainSorted[0].date === '2025-08-01', '가장 오래된 기록이 첫 번째 막대');
assert(mainSorted[mainSorted.length - 1].date === '2025-08-22', '가장 최근 기록이 마지막 막대');

console.log('=== 3. "유산소 추세" 정렬 규칙 = CardioTracker.isCardioWorkout 필터 추가 ===');
const cardioSorted = TrendChartQuickActions.buildSortedForContainer('cardioTrendChart', completed);
assert(cardioSorted.length === 2, '유산소 기록만 2건 필터링');
assert(cardioSorted[0].date === '2025-08-03', '유산소 첫 번째(런닝)');
assert(cardioSorted[1].date === '2025-08-10', '유산소 두 번째(자전거)');

console.log('=== 4. completedIndexToRawIndex: 진행중 기록을 건너뛰고 원본 인덱스로 환산 ===');
// completed[2] = rawWorkouts[3](스쿼트, idx 3) — 사이에 진행중(idx 2) 1건이 끼어 있음
assert(TrendChartQuickActions.completedIndexToRawIndex(2) === 3, 'completed idx 2 → raw idx 3(진행중 1건 건너뜀)');
// completed[6] = rawWorkouts[8](레그프레스, idx 8) — 사이에 진행중(idx 2, idx 7) 2건
assert(TrendChartQuickActions.completedIndexToRawIndex(6) === 8, 'completed idx 6 → raw idx 8(진행중 2건 건너뜀)');

console.log('=== 5. 막대에 a11y 속성 부여(role=button/tabindex) ===');
TrendChartQuickActions.init();
const mainWrap = trendChart.children[0];
mainWrap.children.forEach((bar) => {
  assert(bar.getAttribute('role') === 'button', '막대에 role=button 부여');
  assert(bar.getAttribute('tabindex') === '0', '막대에 tabindex 부여');
});

console.log('=== 6. 스타일 주입: 탭 가능 표시(커서) ===');
const styleEl = document.getElementById('trend-chart-quick-actions-styles');
assert(!!styleEl, '스타일 주입됨');

console.log('=== 7. 막대 탭 → Log 목록 탭으로 이동 + 필요한 만큼 더보기 + 상세 펼침 + 스크롤 ===');
// "최근 추세"의 3번째 막대(index 2) = mainSorted[2] = completed[2] = raw idx 3(스쿼트, 2025-08-08)
const targetBar = mainWrap.children[2];
fire(trendChart, 'click', targetBar);

assert(switchViewCalls[switchViewCalls.length - 1] === 'log', 'switchView("log") 호출');
assert(setLogTabCalls[setLogTabCalls.length - 1] === 'list', 'setLogTab("list") 호출(목록 뷰)');

const lastToggle = toggleDetailCalls[toggleDetailCalls.length - 1];
assert(lastToggle.itemId === 'wi-3', '스쿼트 기록(raw idx 3)의 상세를 펼침');
assert(lastToggle.panelId === 'wp-3', '해당 패널 id로 toggleDetail 호출');

const targetItem = document.getElementById('wi-3');
assert(targetItem._scrolledIntoView === true, '펼친 카드로 스크롤함');
assert(targetItem.classList.contains('tcqa-highlight'), '하이라이트 클래스 부여');
assert(timeoutQueue.length > 0, '하이라이트 제거를 위한 타이머 예약');
timeoutQueue.pop()();
assert(!targetItem.classList.contains('tcqa-highlight'), '타이머 실행 후 하이라이트 제거');

console.log('=== 8. 목록에서 아직 안 보이던(페이지 밖) 카드도 자동으로 더 보기 후 노출 ===');
// "최근 추세"의 첫 번째 막대(index 0) = raw idx 0(2025-08-01, 날짜 내림차순 기준 가장 뒤쪽 페이지)
visibleCount = LOG_PAGE_SIZE; // 페이지네이션 초기화(다른 탭으로 이동했다가 목록을 다시 그린 상황 재현)
const firstBar = mainWrap.children[0];
fire(trendChart, 'click', firstBar);
const firstToggle = toggleDetailCalls[toggleDetailCalls.length - 1];
assert(firstToggle.itemId === 'wi-0', '가장 오래된 기록(raw idx 0)도 정확히 찾아서 펼침');
assert(LogList.getVisibleCount() >= 10, '해당 카드가 보일 때까지 더보기를 반복 호출함');

console.log('=== 9. 키보드(Enter)로도 동일하게 동작 ===');
fireKey(cardioTrendChart, 'keydown', cardioTrendChart.children[0].children[0], 'Enter');
const cardioToggle = toggleDetailCalls[toggleDetailCalls.length - 1];
// cardioSorted[0] = raw idx 1(런닝, 2025-08-03)
assert(cardioToggle.itemId === 'wi-1', 'Enter 키로 유산소 추세 첫 막대(런닝) 상세 오픈');

console.log('=== 10. 완성된 모듈은 수정하지 않음(참조/재사용만) ===');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const logListJs = fs.readFileSync(path.join(__dirname, 'logList.js'), 'utf8');
const cardioTrackerJs = fs.readFileSync(path.join(__dirname, 'cardioTracker.js'), 'utf8');
assert(!appJs.includes('TrendChartQuickActions'), 'app.js 미참조');
assert(!logListJs.includes('TrendChartQuickActions'), 'logList.js 미참조(공개 API만 재사용)');
assert(!cardioTrackerJs.includes('TrendChartQuickActions'), 'cardioTracker.js 미참조(공개 API만 재사용)');

const tcqaJs = fs.readFileSync(path.join(__dirname, 'trendChartQuickActions.js'), 'utf8');
assert(tcqaJs.includes('LogList.sortWithIndex'), 'LogList.sortWithIndex 재사용');
assert(tcqaJs.includes('LogList.loadMore'), 'LogList.loadMore 재사용');
assert(tcqaJs.includes('LogList.toggleDetail'), 'LogList.toggleDetail 재사용');
assert(tcqaJs.includes('CardioTracker.isCardioWorkout'), 'CardioTracker.isCardioWorkout 재사용');

console.log('=== 11. 정적 연동 검사 (index.html / sw.js) ===');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(indexHtml.includes('<script src="trendChartQuickActions.js"></script>'), '스크립트 등록');
assert(indexHtml.includes('TrendChartQuickActions.init()'), '부트스트랩에서 init 호출');
assert(indexHtml.indexOf('<script src="trendChartQuickActions.js">') > indexHtml.indexOf('<script src="logList.js">'),
  'LogList 스크립트 이후에 로드됨(의존 모듈 먼저 로드)');

const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(swJs.includes("'./trendChartQuickActions.js'"), 'sw ASSETS 등록');
assert(swJs.includes("'/trendChartQuickActions.js'"), 'sw NETWORK_FIRST 등록');
assert(swJs.includes('recovr-cache-v77'), 'sw 캐시 버전 상승');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
