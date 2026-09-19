#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const listeners = {};
global.sessionStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};

global.document = {
  visibilityState: 'visible',
  body: { offsetHeight: 1 },
  getElementById(id) {
    if (id === 'modalOverlay') {
      return { classList: { contains: () => false, add() {}, remove() {} } };
    }
    return null;
  },
  querySelector() { return { id: 'view-home' }; },
  addEventListener(type, fn) {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  },
};

global.window = {
  scrollY: 0,
  scrollTo() {},
  focus() {},
  addEventListener(type, fn) {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  },
};

global.setTimeout = (fn) => { fn(); return 1; };
global.clearTimeout = () => {};
global.setInterval = () => 1;
global.clearInterval = () => {};
global.requestAnimationFrame = (fn) => { fn(); return 1; };

global.activeSessionId = 'sess_test';
global.findInProgressWorkout = () => ({
  sessionId: 'sess_test',
  updatedAt: new Date().toISOString(),
  exercises: [{ name: '벤치프레스' }],
  type: 'upper',
  fatigue: 3,
  date: '2026-08-04',
  startTime: '10:00',
  duration: 40,
});
global.resumeInProgressModal = () => true;
global.switchView = () => {};
global.CelebrateFx = { showToast() {} };

const AppResume = new Function(
  fs.readFileSync(path.join(__dirname, 'appResume.js'), 'utf8') + '; return AppResume;'
)();

assert(typeof AppResume.init === 'function', 'init exists');
assert(typeof AppResume.snapshotUi === 'function', 'snapshotUi exists');
assert(typeof AppResume.coldRestore === 'function', 'coldRestore exists');
assert(AppResume.AUTO_RESTORE_MS === 6 * 60 * 60 * 1000, 'auto restore window 6h');

AppResume.init();
assert(!!listeners.visibilitychange, 'listens visibilitychange');
assert(!!listeners.pageshow, 'listens pageshow');
assert(!!listeners.pagehide, 'listens pagehide');
assert(!!listeners.freeze, 'listens freeze');
assert(!!listeners.resume, 'listens resume');

const snap = AppResume.snapshotUi('test');
assert(snap && snap.modalOpen === false, 'snapshot modal closed');
assert(snap.sessionId === 'sess_test', 'snapshot session id');
assert(snap.view === 'home', 'snapshot view');

// init()의 setTimeout에서 coldRestore가 이미 1회 수행됨
assert(AppResume.coldRestore() === false, 'cold restore runs once only');

// wiring
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const duration = fs.readFileSync(path.join(__dirname, 'durationTimer.js'), 'utf8');
const rest = fs.readFileSync(path.join(__dirname, 'restTimer.js'), 'utf8');

assert(indexHtml.includes('appResume.js'), 'index loads module');
assert(sw.includes('appResume.js'), 'sw caches module');
assert(sw.includes('recovr-cache-v76'), 'sw cache bump');
assert(app.includes('AppResume.init()'), 'app wires init');
assert(app.includes('function resumeInProgressModal'), 'app exposes restore helper');
assert(app.includes("AppResume.snapshotUi('modal-close')"), 'closeModal updates resume snapshot');
assert(duration.includes('onAppResume'), 'duration timer resume hook');
assert(rest.includes('onAppResume'), 'rest timer resume hook');
assert(rest.includes('resumeFromState'), 'rest timer state restore');
assert(rest.includes('getResumeState'), 'rest timer state snapshot');

console.log(failures === 0 ? 'AppResume tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
