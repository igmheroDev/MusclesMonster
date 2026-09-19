#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// ------------------------------------------------------------
// 최소 fake DOM (test-heatmap-mode-tabs.js / test-youtube-search-link.js와 동일한 관례)
// ------------------------------------------------------------
const createdElements = [];

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
    set(v) {
      el._text = String(v);
      el.children = [];
    },
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
// 홈 "부위별 회복 상태" (#muscleList) 목업 — 코어/어깨 카드 2개
// ------------------------------------------------------------
function makeMuscleCard(name) {
  const card = makeEl('div');
  card.classList.add('muscle-card');
  const nameEl = makeEl('div');
  nameEl.classList.add('mc-name');
  nameEl.textContent = name;
  card.appendChild(nameEl);
  return card;
}

const muscleList = makeEl('div');
muscleList.id = 'muscleList';
const coreCard = makeMuscleCard('코어');
const shoulderCard = makeMuscleCard('어깨');
muscleList.appendChild(coreCard);
muscleList.appendChild(shoulderCard);

// ------------------------------------------------------------
// 통계 "주간 부위별 빈도" (#freqList) 목업 — 삼두 행 1개
// ------------------------------------------------------------
function makeFreqRow(labelText, statusText) {
  const row = makeEl('div');
  const labelSpan = makeEl('span');
  labelSpan.textContent = labelText;
  const statusSpan = makeEl('span');
  statusSpan.textContent = statusText;
  row.appendChild(labelSpan);
  row.appendChild(statusSpan);
  return row;
}

const freqList = makeEl('div');
freqList.id = 'freqList';
const freqWrap = makeEl('div');
freqWrap.classList.add('muscle-card');
const tricepsRow = makeFreqRow('🔱 삼두', '1회');
freqWrap.appendChild(tricepsRow);
freqList.appendChild(freqWrap);

// ------------------------------------------------------------
// 통계 "🏆 개인 기록 (PR)" (#prList) 목업 — 스쿼트/레그프레스 카드
// ------------------------------------------------------------
const prList = makeEl('div');
prList.id = 'prList';
const squatCard = makeMuscleCard('스쿼트');
const legPressCard = makeMuscleCard('레그프레스');
prList.appendChild(squatCard);
prList.appendChild(legPressCard);

global.document = {
  readyState: 'complete',
  head,
  documentElement: makeEl('html'),
  getElementById(id) {
    if (id === 'muscleList') return muscleList;
    if (id === 'freqList') return freqList;
    if (id === 'prList') return prList;
    return createdElements.find((e) => e.id === id) || null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    createdElements.push(el);
    return el;
  },
  addEventListener() {},
};

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

const openMuscleCalls = [];
const openExerciseCalls = [];
global.ExerciseStimHeatmap = {
  openMuscle(muscleKey) { openMuscleCalls.push(muscleKey); },
  openExercise(name, opts) { openExerciseCalls.push({ name, opts }); },
};

const prTrendOpenCalls = [];
global.PrTrendDetail = {
  open(name) { prTrendOpenCalls.push(name); },
};

const ListQuickActions = new Function(
  fs.readFileSync(path.join(__dirname, 'listQuickActions.js'), 'utf8') + '; return ListQuickActions;'
)();

console.log('=== 1. 모듈 API ===');
assert(typeof ListQuickActions.init === 'function', 'init');
assert(typeof ListQuickActions.ensureStyles === 'function', 'ensureStyles');
assert(typeof ListQuickActions.findMuscleKeyByLabel === 'function', 'findMuscleKeyByLabel');

console.log('=== 2. 부위 라벨 → 부위 키 역추적 (겹치는 이름 없이 정확히 매칭) ===');
assert(ListQuickActions.findMuscleKeyByLabel('코어') === 'core', '코어 매칭');
assert(ListQuickActions.findMuscleKeyByLabel('🔱 삼두') === 'triceps', '아이콘 포함 텍스트에서도 매칭');
assert(ListQuickActions.findMuscleKeyByLabel('없는부위') === null, '매칭 안되면 null');

console.log('=== 3. 스타일 주입: 탭 가능 표시(커서/화살표) ===');
ListQuickActions.init();
const styleEl = document.getElementById('list-quick-actions-styles');
assert(!!styleEl, '스타일 주입됨');
const css = String(styleEl.textContent || '');
assert(css.includes('#muscleList .muscle-card'), '홈 리스트 스타일');
assert(css.includes('#prList .muscle-card'), 'PR 리스트 스타일');
assert(css.includes('#freqList .muscle-card > div'), '빈도 리스트 스타일');
assert(css.includes('cursor: pointer'), '탭 가능 커서');

console.log('=== 4. 홈 "부위별 회복 상태" 카드 탭 → 부위별 추천 운동 시트 오픈 ===');
assert(coreCard.getAttribute('role') === 'button', '카드에 role=button 부여');
assert(coreCard.getAttribute('tabindex') === '0', '카드에 tabindex 부여(키보드 접근)');
fire(muscleList, 'click', coreCard);
assert(openMuscleCalls[openMuscleCalls.length - 1] === 'core', '코어 카드 탭 → openMuscle(core)');

fire(muscleList, 'click', shoulderCard);
assert(openMuscleCalls[openMuscleCalls.length - 1] === 'shoulder', '어깨 카드 탭 → openMuscle(shoulder)');

console.log('=== 4b. 키보드(Enter)로도 동일하게 동작 ===');
fireKey(muscleList, 'keydown', coreCard, 'Enter');
assert(openMuscleCalls[openMuscleCalls.length - 1] === 'core', 'Enter 키로도 openMuscle 호출');

console.log('=== 5. 통계 "주간 부위별 빈도" 행 탭 → 해당 부위 추천 운동 시트 오픈 ===');
fire(freqList, 'click', tricepsRow.children[0]);
assert(openMuscleCalls[openMuscleCalls.length - 1] === 'triceps', '삼두 행 탭 → openMuscle(triceps)');

console.log('=== 6. 통계 "🏆 개인 기록(PR)" 카드 탭 → 그 운동의 기록 추이 시트 오픈(PrTrendDetail) ===');
fire(prList, 'click', squatCard);
assert(prTrendOpenCalls[prTrendOpenCalls.length - 1] === '스쿼트', '스쿼트 카드 탭 → PrTrendDetail.open(스쿼트)');
assert(openExerciseCalls.length === 0, 'PrTrendDetail이 있으면 자극 부위 시트로 폴백하지 않음');

fire(prList, 'click', legPressCard);
assert(prTrendOpenCalls[prTrendOpenCalls.length - 1] === '레그프레스', '레그프레스 카드 탭 → PrTrendDetail.open(레그프레스)');

console.log('=== 6b. PrTrendDetail이 없는 환경에서는 기존 자극 부위 시트로 폴백 ===');
const savedPrTrendDetail = global.PrTrendDetail;
delete global.PrTrendDetail;
fire(prList, 'click', squatCard);
let lastCall = openExerciseCalls[openExerciseCalls.length - 1];
assert(lastCall.name === '스쿼트', '폴백: 스쿼트 카드 탭 → openExercise(스쿼트, ...)');
assert(lastCall.opts && lastCall.opts.showAdd === false, '폴백에서도 "이 운동 추가" 버튼 숨김(showAdd:false)');
global.PrTrendDetail = savedPrTrendDetail;

console.log('=== 7. 재렌더(innerHTML 교체) 이후에도 다시 탭 가능해야 함(MutationObserver 재적용) ===');
// muscle-card 텍스트 교체(app.js가 실제로 하는 것처럼 이름이 바뀐 새 카드로 대체)
muscleList.children = [];
const backCard = makeMuscleCard('등');
muscleList.appendChild(backCard);
assert(backCard.getAttribute('role') !== 'button', '재렌더 직후에는 아직 미적용');
// MutationObserver가 없는 환경(Node)에서는 즉시 재적용되지 않으므로, 페이지 흐름과
// 동일하게 재초기화(init)를 다시 호출해도 기존 훅이 중복 등록되지 않고 동작해야 한다.
ListQuickActions.init();
assert(backCard.getAttribute('role') === 'button', 'init 재호출로 새 카드도 a11y 속성 적용');
fire(muscleList, 'click', backCard);
assert(openMuscleCalls[openMuscleCalls.length - 1] === 'back', '재렌더된 카드도 정상적으로 열림');

console.log('=== 8. 완성된 모듈은 수정하지 않음(참조/재사용만) ===');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const eshJs = fs.readFileSync(path.join(__dirname, 'exerciseStimHeatmap.js'), 'utf8');
const mhJs = fs.readFileSync(path.join(__dirname, 'muscleHeatmap.js'), 'utf8');
assert(!appJs.includes('ListQuickActions'), 'app.js는 ListQuickActions를 참조하지 않음(완전히 독립적으로 DOM만 관찰)');
assert(!eshJs.includes('ListQuickActions'), 'exerciseStimHeatmap.js 미참조(읽기 전용 재사용만)');
assert(!mhJs.includes('ListQuickActions'), 'muscleHeatmap.js 미참조');

const lqaJs = fs.readFileSync(path.join(__dirname, 'listQuickActions.js'), 'utf8');
assert(lqaJs.includes('ExerciseStimHeatmap.openMuscle') || lqaJs.includes("'openMuscle'"), 'ExerciseStimHeatmap.openMuscle 재사용');
assert(lqaJs.includes('openExercise'), 'ExerciseStimHeatmap.openExercise 재사용(폴백)');
assert(lqaJs.includes('PrTrendDetail.open'), 'PrTrendDetail.open 재사용');
assert(!appJs.includes('PrTrendDetail'), 'app.js는 PrTrendDetail을 참조하지 않음');

console.log('=== 9. 정적 연동 검사 (index.html / sw.js) ===');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(indexHtml.includes('<script src="listQuickActions.js"></script>'), '스크립트 등록');
assert(indexHtml.includes('<script src="prTrendDetail.js"></script>'), 'prTrendDetail.js 스크립트 등록');
assert(indexHtml.includes('ListQuickActions.init()'), '부트스트랩에서 init 호출');
assert(indexHtml.indexOf('<script src="listQuickActions.js">') > indexHtml.indexOf('<script src="exerciseStimHeatmap.js">'),
  'ExerciseStimHeatmap 스크립트 이후에 로드됨(의존 모듈 먼저 로드)');
assert(indexHtml.indexOf('<script src="listQuickActions.js">') > indexHtml.indexOf('<script src="prTrendDetail.js">'),
  'PrTrendDetail 스크립트 이후에 로드됨(의존 모듈 먼저 로드)');
assert(indexHtml.includes('id="prTrendOverlay"'), 'PR 기록 추이 시트 오버레이 등록');

const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(swJs.includes("'./listQuickActions.js'"), 'sw ASSETS 등록');
assert(swJs.includes("'/listQuickActions.js'"), 'sw NETWORK_FIRST 등록');
assert(swJs.includes("'./prTrendDetail.js'"), 'sw ASSETS에 prTrendDetail.js 등록');
assert(swJs.includes("'/prTrendDetail.js'"), 'sw NETWORK_FIRST에 prTrendDetail.js 등록');
assert(swJs.includes('recovr-cache-v77'), 'sw 캐시 버전 상승');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
