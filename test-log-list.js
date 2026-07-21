#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// minimal DOM stub for style injection / list render
const elements = new Map();
function makeEl(tag, id) {
  let html = '';
  const el = {
    id: id || '',
    tagName: String(tag).toUpperCase(),
    className: '',
    style: {},
    dataset: {},
    children: [],
    textContent: '',
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); el.className = [...this._set].join(' '); },
      remove(c) { this._set.delete(c); el.className = [...this._set].join(' '); },
      contains(c) { return this._set.has(c); },
    },
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      // innerHTML 교체 시 자식 초기화 (브라우저와 동일)
      el.children = [];
    },
    appendChild(child) { this.children.push(child); return child; },
    querySelector(sel) {
      if (sel === '.log-detail-body') {
        return this.children.find((c) => (c.className || '').includes('log-detail-body'))
          || null;
      }
      return null;
    },
    addEventListener() {},
  };
  if (id) elements.set(id, el);
  return el;
}

global.document = {
  head: makeEl('head'),
  body: makeEl('body'),
  getElementById(id) {
    if (id === 'workoutList') {
      if (!elements.has('workoutList')) elements.set('workoutList', makeEl('div', 'workoutList'));
      return elements.get('workoutList');
    }
    return elements.get(id) || null;
  },
  createElement(tag) { return makeEl(tag); },
  querySelectorAll() { return []; },
};

const sample = [];
for (let i = 0; i < 95; i++) {
  sample.push({
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    type: 'upper',
    duration: 60,
    fatigue: 3,
    exercises: [{ name: `운동${i}`, weight: 40, reps: 10, setDetails: [{ weight: 40, reps: 10, completed: true }] }],
  });
}
// 최신 날짜를 뒤에 두어 정렬 검증
sample[10].date = '2026-07-17';
sample[20].date = '2026-07-16';

global.loadWorkouts = () => sample;
global.getExerciseVolume = () => 400;
global.getWorkoutTypeMeta = () => ({ label: '상체', cls: 'upper' });
global.getActivityTagsFromExerciseName = () => [];
global.NON_MUSCLE_LABELS = {};
global.buildExerciseDetailHTML = (w, idx) => `<div class="exercise-detail-row">${w.exercises[0].name}:${idx}</div>`;
global.openEditModal = () => {};
global.deleteWorkoutPrompt = () => {};

const LogList = new Function(
  fs.readFileSync(path.join(__dirname, 'logList.js'), 'utf8') + '; return LogList;'
)();

assert(LogList.PAGE_SIZE === 40, 'page size 40');
assert(typeof LogList.render === 'function', 'render exists');
assert(typeof LogList.loadMore === 'function', 'loadMore exists');
assert(typeof LogList.toggleDetail === 'function', 'toggleDetail exists');

const sorted = LogList.sortWithIndex(sample);
assert(sorted.length === 95, 'sort keeps length');
assert(sorted[0].w.date === '2026-07-17', 'newest first');
assert(sorted[1].w.date === '2026-07-16', 'second newest');
assert(sorted[0].idx === 10, 'preserves original index');

const page = LogList.getVisibleEntries(sorted, 40);
assert(page.length === 40, 'first page length');
assert(LogList.hasMore(95, 40) === true, 'has more at 40');
assert(LogList.hasMore(95, 95) === false, 'no more at end');
assert(LogList.hasMore(30, 40) === false, 'no more when total < page');

LogList.render({ reset: true });
assert(LogList.getVisibleCount() === 40, 'reset visible to page size');
const list = document.getElementById('workoutList');
assert(list.children.length === 41, '40 items + load more wrap'); // 40 + load more
assert(!!document.getElementById('log-list-styles') || document.head.children.length >= 1, 'styles injected');

LogList.loadMore();
assert(LogList.getVisibleCount() === 80, 'load more -> 80');
LogList.loadMore();
assert(LogList.getVisibleCount() === 120, 'load more -> 120');
assert(LogList.hasMore(95, 120) === false, 'beyond total has no more conceptually');

// lazy detail: panel body starts empty
const firstPanelId = `wp-${sorted[0].idx}`;
// recreate clean render for detail test
LogList.render({ reset: true });
const panel = makeEl('div', firstPanelId);
panel.dataset.realIdx = String(sorted[0].idx);
panel.dataset.detailReady = '';
const body = makeEl('div');
body.className = 'log-detail-body';
panel.appendChild(body);
elements.set(firstPanelId, panel);
// seed cache via render already done; ensureDetailLoaded uses workoutByIdx from last render
LogList.ensureDetailLoaded(panel);
assert(panel.dataset.detailReady === '1', 'detail marked ready');
assert(String(body.innerHTML).includes('운동'), 'detail html filled');
assert(String(body.innerHTML).includes('수정'), 'actions included');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(html.includes('logList.js'), 'html script');
assert(sw.includes('logList.js'), 'sw asset');
assert(sw.includes('recovr-cache-v57'), 'cache bump');
assert(app.includes('LogList.render'), 'app delegates render');
assert(app.includes('LogList.toggleDetail'), 'app delegates toggle');

console.log(failures === 0 ? 'LogList tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
