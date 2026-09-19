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
function matches(node, sel) {
  if (!node || !node.classList) return false;
  if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
  return false;
}

function findAll(root, sel) {
  const out = [];
  function walk(n) {
    (n.children || []).forEach((c) => {
      if (matches(c, sel)) out.push(c);
      walk(c);
    });
  }
  walk(root);
  return out;
}

const createdElements = [];

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
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    addEventListener(type, fn) { this._listeners.push([type, fn]); },
    removeEventListener(type, fn) {
      this._listeners = this._listeners.filter((l) => !(l[0] === type && l[1] === fn));
    },
    querySelector(sel) { return findAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return findAll(el, sel); },
    closest(sel) {
      let n = el;
      while (n) {
        if (matches(n, sel)) return n;
        n = n.parentNode;
      }
      return null;
    },
  };
  Object.defineProperty(el, 'textContent', {
    get() { return el._text || ''; },
    set(v) { el._text = String(v); el.children = []; },
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html || ''; },
    set(v) { el._html = String(v); },
  });
  return el;
}

function fire(el, type, target) {
  el._listeners.filter((l) => l[0] === type).forEach((l) => {
    l[1]({ target: target || el, preventDefault() {}, key: undefined });
  });
}

function fireKey(el, type, target, key) {
  el._listeners.filter((l) => l[0] === type).forEach((l) => {
    l[1]({ target: target || el, preventDefault() {}, key });
  });
}

const head = makeEl('head');

// ------------------------------------------------------------
// "이번 주 유산소 기구별" (#cardioMachineList) 목업 — 천국의계단/로잉머신 행 2개
// ------------------------------------------------------------
function makeMachineRow(fullLabel) {
  const row = makeEl('div');
  const labelSpan = makeEl('span');
  labelSpan.textContent = fullLabel;
  const minSpan = makeEl('span');
  minSpan.textContent = '20분';
  row.appendChild(labelSpan);
  row.appendChild(minSpan);
  return row;
}

const cardioMachineList = makeEl('div');
cardioMachineList.id = 'cardioMachineList';
const machineWrap = makeEl('div');
machineWrap.classList.add('muscle-card');
const stairRow = makeMachineRow('🪜 천국의 계단');
const rowingRow = makeMachineRow('🚣 로잉머신');
machineWrap.appendChild(stairRow);
machineWrap.appendChild(rowingRow);
cardioMachineList.appendChild(machineWrap);

// ------------------------------------------------------------
// "유산소 세부 지표" (#cardioMetricsStats) 목업 — .stats-grid 안에 stat-card 3개
// ------------------------------------------------------------
const cardioMetricsStats = makeEl('div');
cardioMetricsStats.id = 'cardioMetricsStats';
const statsGrid = makeEl('div');
statsGrid.classList.add('stats-grid');
const distCard = makeEl('div'); distCard.classList.add('stat-card');
const calCard = makeEl('div'); calCard.classList.add('stat-card');
const hrCard = makeEl('div'); hrCard.classList.add('stat-card');
statsGrid.appendChild(distCard);
statsGrid.appendChild(calCard);
statsGrid.appendChild(hrCard);
cardioMetricsStats.appendChild(statsGrid);

global.document = {
  readyState: 'complete',
  head,
  documentElement: makeEl('html'),
  getElementById(id) {
    if (id === 'cardioMachineList') return cardioMachineList;
    if (id === 'cardioMetricsStats') return cardioMetricsStats;
    return createdElements.find((e) => e.id === id) || null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    createdElements.push(el);
    return el;
  },
  addEventListener() {},
};

// cqaOverlay는 open()/close() 테스트를 위해 createdElements에 미리 등록
const cqaOverlay = makeEl('div');
cqaOverlay.id = 'cqaOverlay';
createdElements.push(cqaOverlay);

// ------------------------------------------------------------
// 전역 매니저 모킹: CardioTracker / CardioMetrics (읽기 전용 재사용 대상)
// ------------------------------------------------------------
const seededWorkouts = [
  {
    date: '2026-09-14',
    exercises: [
      { name: '천국의 계단', mode: 'duration', durationMin: 20, cardioMetrics: { distanceKm: 1.2, calories: 180 } },
    ],
  },
  {
    date: '2026-09-16',
    exercises: [
      { name: '천국의 계단', mode: 'duration', durationMin: 15 },
      { name: '로잉머신', mode: 'duration', durationMin: 10, cardioMetrics: { avgHeartRate: 140 } },
    ],
  },
];

global.getCompletedWorkouts = () => seededWorkouts;

const CARDIO_NAMES = new Set(['천국의 계단', '로잉머신']);

global.CardioTracker = {
  PRESETS: [
    { name: '천국의 계단', icon: '🪜', defaultMin: 20 },
    { name: '로잉머신', icon: '🚣', defaultMin: 15 },
  ],
  isCardioExercise(ex) { return !!ex && CARDIO_NAMES.has(ex.name); },
  getExerciseMinutes(ex) { return ex && ex.durationMin ? ex.durationMin : 0; },
  formatMinutes(min) { return `${min}분`; },
  getWeeklyStats() {
    return { byMachine: { '천국의 계단': 35, '로잉머신': 10 } };
  },
};

global.CardioMetrics = {
  normalizeMetrics(ex) {
    const raw = (ex && ex.cardioMetrics) || {};
    return {
      distanceKm: raw.distanceKm || null,
      calories: raw.calories || null,
      avgHeartRate: raw.avgHeartRate || null,
    };
  },
  hasAny(m) { return !!(m && (m.distanceKm || m.calories || m.avgHeartRate)); },
  formatSummary(ex) {
    const m = this.normalizeMetrics(ex);
    const parts = [];
    if (m.distanceKm) parts.push(`${m.distanceKm}km`);
    if (m.calories) parts.push(`${m.calories}kcal`);
    if (m.avgHeartRate) parts.push(`심박 ${m.avgHeartRate}`);
    return parts.join(' · ');
  },
  // 실제 cardioMetrics.js는 getCardioExercises()를 공개 API로 노출하지 않으므로
  // (내부 전용 함수), 이 목업에도 일부러 포함하지 않는다 — 실수로 비공개 함수에
  // 의존하면 이 목업만으로도 테스트가 즉시 실패하도록 하기 위함.
};

const CardioListQuickActions = new Function(
  fs.readFileSync(path.join(__dirname, 'cardioListQuickActions.js'), 'utf8') + '; return CardioListQuickActions;'
)();

console.log('=== 1. 모듈 API ===');
assert(typeof CardioListQuickActions.init === 'function', 'init');
assert(typeof CardioListQuickActions.open === 'function', 'open');
assert(typeof CardioListQuickActions.close === 'function', 'close');
assert(typeof CardioListQuickActions.closeOnOverlay === 'function', 'closeOnOverlay');

console.log('=== 2. 행 텍스트에서 아이콘을 뗀 운동명 추출 ===');
assert(CardioListQuickActions.extractExerciseName('🪜 천국의 계단') === '천국의 계단', '아이콘+이름에서 이름만 추출');
assert(CardioListQuickActions.extractExerciseName('🚣 로잉머신') === '로잉머신', '다른 프리셋도 동일');

console.log('=== 3. 스타일 주입 ===');
CardioListQuickActions.init();
const styleEl = document.getElementById('cardio-list-quick-actions-styles');
assert(!!styleEl, '스타일 주입됨');
const css = String(styleEl.textContent || '');
assert(css.includes('#cardioMachineList .muscle-card > div'), '기구별 리스트 스타일');
assert(css.includes('#cardioMetricsStats .stats-grid .stat-card'), '세부지표(데이터 있을 때만) 스타일');

console.log('=== 4. "이번 주 유산소 기구별" 행 탭 → 그 기구의 최근 세션 시트 오픈 ===');
assert(stairRow.getAttribute('role') === 'button', '행에 role=button 부여');
assert(stairRow.getAttribute('tabindex') === '0', '행에 tabindex 부여');
fire(cardioMachineList, 'click', stairRow.children[0]);
assert(cqaOverlay.classList.contains('show'), '시트 오픈됨');
assert(cqaOverlay.innerHTML.includes('🪜 천국의 계단'), '기구명이 제목에 표시됨');
assert(cqaOverlay.innerHTML.includes('이번 주 합계 35분'), '주간 합계 표시(CardioTracker.getWeeklyStats 재사용)');
assert(cqaOverlay.innerHTML.includes('1.2km'), '세부 지표(거리)가 있는 세션은 함께 표시');
assert((cqaOverlay.innerHTML.match(/border-bottom/g) || []).length === 2, '천국의 계단 세션 2건이 목록에 표시됨');
CardioListQuickActions.close();
assert(!cqaOverlay.classList.contains('show'), '닫기 동작');

console.log('=== 4b. 키보드(Enter)로도 동일하게 동작 ===');
fireKey(cardioMachineList, 'keydown', rowingRow.children[0], 'Enter');
assert(cqaOverlay.innerHTML.includes('🚣 로잉머신'), 'Enter 키로 로잉머신 시트 오픈');
assert(cqaOverlay.innerHTML.includes('심박 140'), '로잉머신 세션의 심박 지표 표시');
CardioListQuickActions.close();

console.log('=== 5. "유산소 세부 지표" 타일 탭 → 이번 주 세션별 기록 시트 오픈 ===');
assert(distCard.getAttribute('role') === 'button', '데이터 있을 때 stat-card에 role 부여');
fire(cardioMetricsStats, 'click', distCard);
assert(cqaOverlay.classList.contains('show'), '세부지표 시트 오픈됨');
assert(cqaOverlay.innerHTML.includes('이번 주 세션별 기록'), '세부지표 시트 제목');
assert(cqaOverlay.innerHTML.includes('천국의 계단'), '거리 기록이 있는 천국의 계단 세션 표시');
assert(cqaOverlay.innerHTML.includes('로잉머신'), '심박 기록이 있는 로잉머신 세션도 표시');
assert(cqaOverlay.innerHTML.split('천국의 계단').length - 1 === 1,
  '지표가 없는 두 번째 천국의계단 세션(15분, cardioMetrics 없음)은 목록에서 제외됨');
CardioListQuickActions.close();

console.log('=== 5b. 데이터 없는 상태(.stats-grid 없음)로 바뀌면 탭해도 반응 없음 ===');
// renderStatsCard()가 기록이 없을 때 실제로 하는 것처럼, 안내 문구 카드 1개로 교체
cardioMetricsStats.children = [];
const emptyStatCard = makeEl('div'); emptyStatCard.classList.add('stat-card');
cardioMetricsStats.appendChild(emptyStatCard);
CardioListQuickActions.init(); // 재렌더 후 재적용 시나리오(MutationObserver 대체)
assert(emptyStatCard.getAttribute('role') !== 'button', '빈 상태 카드는 a11y 속성을 부여하지 않음');
fire(cardioMetricsStats, 'click', emptyStatCard);
assert(!cqaOverlay.classList.contains('show'), '빈 상태에서는 시트가 열리지 않음');

console.log('=== 6. 완성된 모듈은 수정하지 않음(참조/재사용만) ===');
const cardioTrackerJs = fs.readFileSync(path.join(__dirname, 'cardioTracker.js'), 'utf8');
const cardioMetricsJs = fs.readFileSync(path.join(__dirname, 'cardioMetrics.js'), 'utf8');
assert(!cardioTrackerJs.includes('CardioListQuickActions'), 'cardioTracker.js 미참조');
assert(!cardioMetricsJs.includes('CardioListQuickActions'), 'cardioMetrics.js 미참조');

const clqaJs = fs.readFileSync(path.join(__dirname, 'cardioListQuickActions.js'), 'utf8');
assert(clqaJs.includes('tracker.isCardioExercise'), 'CardioTracker.isCardioExercise 재사용');
assert(clqaJs.includes('metricsMod.formatSummary'), 'CardioMetrics.formatSummary 재사용');
assert(!/^\s*const\s+CardioTracker\s*=/m.test(clqaJs) && !/^\s*const\s+CardioMetrics\s*=/m.test(clqaJs),
  'CardioTracker/CardioMetrics를 재정의하지 않고 참조만 함');

console.log('=== 7. 정적 연동 검사 (index.html / sw.js) ===');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(indexHtml.includes('<script src="cardioListQuickActions.js"></script>'), '스크립트 등록');
assert(indexHtml.includes('CardioListQuickActions.init()'), '부트스트랩에서 init 호출');
assert(indexHtml.includes('id="cqaOverlay"'), '전용 오버레이 컨테이너 추가');
assert(!indexHtml.match(/\.cqa-overlay\s*\{/), '신규 CSS 클래스 추가 없이 기존 esh-overlay 재사용');
assert(indexHtml.indexOf('<script src="cardioListQuickActions.js">') > indexHtml.indexOf('<script src="cardioTracker.js">'),
  'CardioTracker 스크립트 이후에 로드됨(의존 모듈 먼저 로드)');

const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(swJs.includes("'./cardioListQuickActions.js'"), 'sw ASSETS 등록');
assert(swJs.includes("'/cardioListQuickActions.js'"), 'sw NETWORK_FIRST 등록');
assert(swJs.includes('recovr-cache-v76'), 'sw 캐시 버전 상승');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
