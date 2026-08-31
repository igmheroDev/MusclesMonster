#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// ── 최소 fake DOM (createElement/appendChild/insertBefore/querySelector(All)/이벤트 버블링) ──
function makeElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    _children: [],
    parentNode: null,
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      contains(c) { return this._set.has(c); },
    },
    dataset: {},
    _attrs: {},
    _text: '',
    _listeners: [],
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k]; },
    appendChild(child) {
      child.parentNode = this;
      this._children.push(child);
      return child;
    },
    insertBefore(newNode, refNode) {
      newNode.parentNode = this;
      const idx = this._children.indexOf(refNode);
      if (idx === -1) this._children.push(newNode);
      else this._children.splice(idx, 0, newNode);
      return newNode;
    },
    querySelector(sel) { return findAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return findAll(el, sel); },
    addEventListener(type, fn) { this._listeners.push([type, fn]); },
    // 버블링 + stopPropagation을 흉내내는 간단한 dispatch
    dispatch(type) {
      const event = {
        target: el,
        defaultPrevented: false,
        _stopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this._stopped = true; },
      };
      let node = el;
      while (node) {
        node._listeners.filter((l) => l[0] === type).forEach((l) => l[1](event));
        if (event._stopped) break;
        node = node.parentNode;
      }
      return event;
    },
  };
  Object.defineProperty(el, 'textContent', {
    get() { return el._text; },
    set(v) { el._text = String(v); },
  });
  // 실제 DOM처럼 .className 대입이 classList와 동기화되도록 흉내
  Object.defineProperty(el, 'className', {
    get() { return Array.from(el.classList._set).join(' '); },
    set(v) {
      el.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
    },
  });
  return el;
}

function matchesSelector(node, sel) {
  return sel.startsWith('.') && node.classList && node.classList.contains(sel.slice(1));
}

function findAll(root, sel) {
  const results = [];
  (function walk(node) {
    (node._children || []).forEach((child) => {
      if (matchesSelector(child, sel)) results.push(child);
      walk(child);
    });
  })(root);
  return results;
}

function appendAll(parent, children) {
  children.forEach((c) => parent.appendChild(c));
  return parent;
}

function withText(el, text) {
  el.textContent = text;
  return el;
}

console.log('=== 1. buildSearchUrl / open ===');
{
  global.window = { open: (...args) => { global.window._calls.push(args); } };
  global.window._calls = [];

  const YoutubeSearchLink = new Function(
    fs.readFileSync(path.join(__dirname, 'youtubeSearchLink.js'), 'utf8') + '; return YoutubeSearchLink;'
  )();

  const url = YoutubeSearchLink.buildSearchUrl('스쿼트');
  assert(url.startsWith('https://www.youtube.com/results?search_query='), '유튜브 검색 URL 형식');
  assert(decodeURIComponent(url.split('=')[1]).includes('스쿼트'), '검색어에 운동명 포함');
  assert(decodeURIComponent(url.split('=')[1]).includes('운동 방법'), '검색어에 "운동 방법" 접미사 포함');

  YoutubeSearchLink.open('스쿼트');
  assert(global.window._calls.length === 1, 'open() 호출 시 window.open 1회 호출');
  assert(global.window._calls[0][0] === url, 'open()이 buildSearchUrl과 동일한 URL로 오픈');
  assert(global.window._calls[0][1] === '_blank', '새 탭으로 오픈');

  global.window._calls = [];
  YoutubeSearchLink.open('');
  assert(global.window._calls.length === 0, '운동명이 없으면 오픈하지 않음');
}

console.log('=== 2. 부위별 추천 운동 목록 항목에 "▶ 영상" 버튼 연결 (#eshMuscleOverlay) ===');
{
  global.window = { open: (...args) => { global.window._calls.push(args); } };
  global.window._calls = [];

  const muscleOverlay = makeElement('div');
  const itemClicks = [];

  function makeExItem(name) {
    const item = makeElement('button');
    item.classList.add('esh-ex-item');
    item.addEventListener('click', () => itemClicks.push(name));
    const main = makeElement('div');
    main.classList.add('esh-ex-main');
    const nameEl = withText(makeElement('div'), name);
    nameEl.classList.add('esh-ex-name');
    main.appendChild(nameEl);
    item.appendChild(main);
    return item;
  }

  const squatItem = makeExItem('스쿼트');
  const lungeItem = makeExItem('런지');
  appendAll(muscleOverlay, [squatItem, lungeItem]);

  global.document = {
    getElementById(id) { return id === 'eshMuscleOverlay' ? muscleOverlay : null; },
    createElement(tag) { return makeElement(tag); },
  };
  global.MutationObserver = undefined; // observer 없이도 최초 1회는 직접 enhance 호출됨

  const YoutubeSearchLink = new Function(
    fs.readFileSync(path.join(__dirname, 'youtubeSearchLink.js'), 'utf8') + '; return YoutubeSearchLink;'
  )();

  YoutubeSearchLink.enhanceMuscleOverlay();

  const squatBtn = squatItem.querySelector('.ytl-btn');
  const lungeBtn = lungeItem.querySelector('.ytl-btn');
  assert(!!squatBtn && !!lungeBtn, '각 운동 항목에 유튜브 버튼이 추가됨');

  squatBtn.dispatch('click');
  assert(global.window._calls.length === 1, '유튜브 버튼 클릭 시 window.open 호출');
  assert(decodeURIComponent(global.window._calls[0][0]).includes('스쿼트'), '클릭한 운동명(스쿼트)으로 검색');
  assert(itemClicks.length === 0, '유튜브 버튼 클릭이 상위 운동 항목의 클릭(자극 미리보기 오픈)으로 전파되지 않음(stopPropagation)');

  // 재호출(재렌더 시뮬레이션)해도 버튼이 중복으로 추가되지 않아야 함
  YoutubeSearchLink.enhanceMuscleOverlay();
  assert(squatItem.querySelectorAll('.ytl-btn').length === 1, '재호출 시 버튼 중복 추가 안 됨');
}

console.log('=== 3. 운동 자극 분할 미리보기 헤더에도 버튼 연결 (esh-split-preview-head) ===');
{
  global.window = { open: (...args) => { global.window._calls.push(args); } };
  global.window._calls = [];

  const muscleOverlay = makeElement('div');
  const head = makeElement('div');
  head.classList.add('esh-split-preview-head');
  const nameEl = withText(makeElement('div'), '벤치 프레스');
  nameEl.classList.add('esh-split-ex-name');
  const closeBtn = withText(makeElement('button'), '접기');
  closeBtn.classList.add('esh-sheet-close');
  appendAll(head, [nameEl, closeBtn]);
  muscleOverlay.appendChild(head);

  global.document = {
    getElementById(id) { return id === 'eshMuscleOverlay' ? muscleOverlay : null; },
    createElement(tag) { return makeElement(tag); },
  };
  global.MutationObserver = undefined;

  const YoutubeSearchLink = new Function(
    fs.readFileSync(path.join(__dirname, 'youtubeSearchLink.js'), 'utf8') + '; return YoutubeSearchLink;'
  )();

  YoutubeSearchLink.enhanceMuscleOverlay();

  const ytBtn = head.querySelector('.ytl-btn');
  assert(!!ytBtn, '분할 미리보기 헤더에도 유튜브 버튼 추가됨');
  assert(head.querySelector('.esh-sheet-close') === closeBtn, '기존 접기 버튼은 그대로 유지됨');

  ytBtn.dispatch('click');
  assert(decodeURIComponent(global.window._calls[0][0]).includes('벤치'), '분할 미리보기의 운동명으로 검색');
}

console.log('=== 4. 단일 운동 자극 상세 시트에 전체 폭 버튼 연결 (#eshExerciseOverlay) ===');
{
  global.window = { open: (...args) => { global.window._calls.push(args); } };
  global.window._calls = [];

  const exerciseOverlay = makeElement('div');
  const sheet = makeElement('div');
  sheet.classList.add('esh-sheet');
  const title = withText(makeElement('div'), '데드리프트');
  title.classList.add('esh-sheet-title');
  const actions = makeElement('div');
  actions.classList.add('esh-actions');
  const addBtn = withText(makeElement('button'), '이 운동 추가');
  actions.appendChild(addBtn);
  appendAll(sheet, [title, actions]);
  exerciseOverlay.appendChild(sheet);

  global.document = {
    getElementById(id) { return id === 'eshExerciseOverlay' ? exerciseOverlay : null; },
    createElement(tag) { return makeElement(tag); },
  };
  global.MutationObserver = undefined;

  const YoutubeSearchLink = new Function(
    fs.readFileSync(path.join(__dirname, 'youtubeSearchLink.js'), 'utf8') + '; return YoutubeSearchLink;'
  )();

  YoutubeSearchLink.enhanceExerciseOverlay();

  const ytBtn = sheet.querySelector('.ytl-video-btn');
  assert(!!ytBtn, '단일 운동 시트에 유튜브 영상 버튼 추가됨');
  assert(sheet._children.indexOf(ytBtn) < sheet._children.indexOf(actions), '유튜브 버튼이 기존 액션 버튼들보다 위에 배치됨');

  ytBtn.dispatch('click');
  assert(decodeURIComponent(global.window._calls[0][0]).includes('데드리프트'), '해당 운동명(데드리프트)으로 검색');

  YoutubeSearchLink.enhanceExerciseOverlay();
  assert(sheet.querySelectorAll('.ytl-video-btn').length === 1, '재호출 시 버튼 중복 추가 안 됨');
}

console.log('=== 5. 다른 모듈과의 연결 지점 확인 (ExerciseStimHeatmap 코드는 수정하지 않음) ===');
{
  const eshJs = fs.readFileSync(path.join(__dirname, 'exerciseStimHeatmap.js'), 'utf8');
  const ytlJs = fs.readFileSync(path.join(__dirname, 'youtubeSearchLink.js'), 'utf8');
  assert(!ytlJs.includes('const ExerciseStimHeatmap ='), '독립 모듈이 ExerciseStimHeatmap을 재정의하지 않음 (읽기 전용 DOM 연결만)');

  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(indexHtml.includes('<script src="youtubeSearchLink.js"></script>'), 'index.html에 스크립트 태그 등록');
  assert(indexHtml.includes('YoutubeSearchLink.init()'), 'index.html 부트스트랩에서 init 호출');
  assert(indexHtml.includes('eshMuscleOverlay') && indexHtml.includes('eshExerciseOverlay'), 'ExerciseStimHeatmap 오버레이 DOM은 그대로 재사용');

  const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  assert(swJs.includes("'./youtubeSearchLink.js'"), 'sw.js ASSETS에 등록');
  assert(swJs.includes("'/youtubeSearchLink.js'"), 'sw.js NETWORK_FIRST_PATHS에 등록');

  // exerciseStimHeatmap.js 자체는 이 기능을 위해 수정되지 않아야 함 (핵심 렌더 함수 시그니처 그대로)
  assert(eshJs.includes('function openMuscle(muscleKey)'), 'ExerciseStimHeatmap.openMuscle 시그니처 그대로 유지');
  assert(eshJs.includes('function openExercise(name, options = {})'), 'ExerciseStimHeatmap.openExercise 시그니처 그대로 유지');
}

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
