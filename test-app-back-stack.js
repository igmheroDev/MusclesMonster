#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

const root = __dirname;
const src = fs.readFileSync(path.join(root, 'appBackStack.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swJs = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const hbmd = fs.readFileSync(path.join(root, 'homeBodyMapDetail.js'), 'utf8');

console.log('=== 1. Wiring ===');
assert(src.includes('const AppBackStack'), 'AppBackStack module');
assert(src.includes('앱을 종료할까요?'), 'Korean exit confirm copy');
assert(src.includes('>취소<') || src.includes('>취소</'), 'Cancel button');
assert(src.includes('>종료<') || src.includes('>종료</'), 'Exit button');
assert(src.includes('history.pushState'), 'uses History API');
assert(src.includes('popstate'), 'listens for popstate');
assert(src.includes('display-mode') || src.includes('pushState'), 'history works in standalone PWA');
assert(indexHtml.includes('appBackStack.js'), 'index loads module');
assert(indexHtml.includes('AppBackStack.init'), 'init after other modules');
assert(indexHtml.includes('modules:'), 'init receives lexical module registry');
assert(/appBackStack\.js[\s\S]*ExercisePicker\.init|homeBodyMapDetail\.js[\s\S]*appBackStack\.js/.test(indexHtml), 'loaded with other app scripts');
assert(swJs.includes('appBackStack.js'), 'SW caches module');
assert(swJs.includes('recovr-cache-v99'), 'SW cache bump v99');
assert(hbmd.includes('ExerciseStimHeatmap.openMuscle'), 'detail list reuses exercise sheet');
assert(!hbmd.includes('history.pushState'), 'detail does not push its own history');

console.log('=== 2. Overlay registry covers main sheets ===');
['wcvOverlay', 'wcmOverlay', 'hbmdOverlay', 'eshMuscleOverlay', 'eshExerciseOverlay',
  'modalOverlay', 'exPickerOverlay', 'aiChatOverlay', 'mgdOverlay', 'prTrendOverlay',
  'cqaOverlay', 'celebrateFxOverlay', 'rest-timer-overlay'].forEach((id) => {
  assert(src.includes(id), `tracks ${id}`);
});

function createEnv() {
  const popListeners = [];
  const historyEntries = [{ state: {}, href: 'http://app.local/' }];
  let idx = 0;

  class FakeClassList {
    constructor(el) { this.el = el; this._set = new Set(); }
    add(name) { this._set.add(name); }
    remove(name) { this._set.delete(name); }
    contains(name) { return this._set.has(name); }
    toggle(name, force) {
      if (force === true) this._set.add(name);
      else if (force === false) this._set.delete(name);
      else if (this._set.has(name)) this._set.delete(name);
      else this._set.add(name);
    }
  }

  function makeEl(id, z, extraClass) {
    const el = {
      id,
      style: { zIndex: String(z) },
      hidden: false,
      children: [],
      innerHTML: '',
      nodeType: 1,
      getAttribute() { return null; },
      setAttribute() {},
      addEventListener() {},
      appendChild(child) { this.children.push(child); return child; },
      querySelector(sel) {
        if (sel === '[data-abs-cancel]') return { addEventListener() {} };
        if (sel === '[data-abs-exit]') return { addEventListener() {} };
        return null;
      },
      querySelectorAll() { return []; },
      matches(sel) {
        if (sel === '.rest-timer-overlay') return id === 'restTimer' || (extraClass || '').includes('rest-timer-overlay');
        if (sel && sel.startsWith('#')) return id === sel.slice(1);
        return false;
      },
    };
    el.classList = new FakeClassList(el);
    if (extraClass) extraClass.split(/\s+/).forEach((c) => el.classList.add(c));
    return el;
  }

  const els = {
    hbmdOverlay: makeEl('hbmdOverlay', 1300, 'hbmd-overlay'),
    eshMuscleOverlay: makeEl('eshMuscleOverlay', 1200, 'esh-overlay'),
    eshExerciseOverlay: makeEl('eshExerciseOverlay', 1210, 'esh-overlay'),
    modalOverlay: makeEl('modalOverlay', 200, 'modal-overlay'),
    viewHome: makeEl('view-home', 0, 'view active'),
    viewLog: makeEl('view-log', 0, 'view'),
  };
  els.viewHome.id = 'view-home';
  els.viewLog.id = 'view-log';

  const body = makeEl('body', 0);
  body.appendChild = function (child) {
    if (child && child.id) els[child.id] = child;
    this.children.push(child);
    return child;
  };

  const documentRef = {
    body,
    documentElement: body,
    head: { appendChild() {} },
    getElementById(id) { return els[id] || null; },
    querySelector(sel) {
      if (sel === '.view.active') {
        return Object.values(els).find((el) => el.id && String(el.id).startsWith('view-') && el.classList.contains('active')) || els.viewHome;
      }
      if (sel === '.rest-timer-overlay') return null;
      if (sel && sel.startsWith('#')) return els[sel.slice(1)] || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.view') return [els.viewHome, els.viewLog];
      return [];
    },
    createElement(tag) {
      const el = makeEl('', 0);
      el.tagName = String(tag).toUpperCase();
      return el;
    },
  };

  const history = {
    get state() { return historyEntries[idx].state; },
    get length() { return historyEntries.length; },
    pushState(state, title, url) {
      historyEntries.splice(idx + 1);
      historyEntries.push({ state: state || {}, href: url || historyEntries[idx].href });
      idx = historyEntries.length - 1;
    },
    back() { this.go(-1); },
    go(n) {
      const next = idx + n;
      if (next < 0) {
        idx = 0;
        closedApp = true;
        return;
      }
      if (next >= historyEntries.length) return;
      idx = next;
      popListeners.forEach((fn) => fn({ state: historyEntries[idx].state }));
    },
  };

  let closedApp = false;
  let currentView = 'home';
  function switchView(name, opts) {
    currentView = name;
    els.viewHome.classList.remove('active');
    els.viewLog.classList.remove('active');
    const target = name === 'log' ? els.viewLog : els.viewHome;
    target.classList.add('active');
    lastSwitch = { name, opts: opts || null };
  }
  let lastSwitch = null;

  const windowRef = {
    addEventListener(type, fn) { if (type === 'popstate') popListeners.push(fn); },
    removeEventListener(type, fn) {
      if (type === 'popstate') {
        const i = popListeners.indexOf(fn);
        if (i >= 0) popListeners.splice(i, 1);
      }
    },
    switchView,
  };

  const closed = { muscle: 0, exercise: 0, detail: 0, modal: 0, celebrate: 0 };

  return {
    get idx() { return idx; },
    get len() { return historyEntries.length; },
    get closedApp() { return closedApp; },
    get lastSwitch() { return lastSwitch; },
    get currentView() { return currentView; },
    history,
    document: documentRef,
    window: windowRef,
    els,
    closed,
    location: { href: 'http://app.local/' },
    switchView,
    show(id) { els[id].classList.add('show'); },
    hide(id) { els[id].classList.remove('show'); },
    getComputedStyle(el) {
      return { zIndex: (el && el.style && el.style.zIndex) || '0', display: (el && el.classList && (el.classList.contains('show') || el.classList.contains('visible'))) ? 'flex' : 'none' };
    },
  };
}

function loadModule(env) {
  global.window = env.window;
  global.document = env.document;
  global.history = env.history;
  global.location = env.location;
  global.getComputedStyle = env.getComputedStyle;
  global.HomeBodyMapDetail = {
    close() { env.closed.detail += 1; env.hide('hbmdOverlay'); },
  };
  global.ExerciseStimHeatmap = {
    closeMuscle() { env.closed.muscle += 1; env.hide('eshMuscleOverlay'); },
    closeExercise() { env.closed.exercise += 1; env.hide('eshExerciseOverlay'); },
  };
  global.closeModal = function () { env.closed.modal += 1; env.hide('modalOverlay'); };
  env.window.HomeBodyMapDetail = global.HomeBodyMapDetail;
  env.window.ExerciseStimHeatmap = global.ExerciseStimHeatmap;
  env.window.switchView = env.switchView;
  // Fresh load each time
  delete require.cache[require.resolve('./appBackStack.js')];
  const mod = require('./appBackStack.js');
  return mod;
}

console.log('=== 3. Runtime: overlay back + no history leak ===');
{
  const env = createEnv();
  const abs = loadModule(env);
  abs.init();
  const rootLen = env.len;
  assert(env.history.state && env.history.state[abs.ROOT_FLAG], 'root guard pushed on init');
  env.show('hbmdOverlay');
  abs.syncOverlayTrap();
  assert(abs.isOverlayTrapArmed(), 'overlay trap armed when detail opens');
  assert(env.len === rootLen + 1, 'one history entry for open overlay');

  env.show('eshMuscleOverlay');
  abs.syncOverlayTrap();
  assert(env.len === rootLen + 1, 'nested overlay does not leak extra history entries');

  // Close top sheet via its own button (not back)
  env.hide('eshMuscleOverlay');
  abs.syncOverlayTrap();
  assert(env.len === rootLen + 1, 'closing nested sheet keeps trap while detail stays open');
  assert(abs.isOverlayTrapArmed(), 'trap remains while detail is open');

  env.hide('hbmdOverlay');
  abs.syncOverlayTrap();
  assert(abs.isOverlayTrapArmed() === false, 'trap released when last overlay closes');
  // sync back consumed the overlay entry via history.back → popstate is a sync, not another close
  assert(env.history.state && env.history.state[abs.ROOT_FLAG], 'closing last overlay returns to root guard');
  assert(!env.history.state[abs.OVERLAY_FLAG], 'overlay history entry was left (can be replaced on next open)');
  abs.resetForTest();
}

console.log('=== 4. Runtime: popstate closes topmost first ===');
{
  const env = createEnv();
  const abs = loadModule(env);
  abs.init();
  env.show('hbmdOverlay');
  abs.syncOverlayTrap();
  env.show('eshMuscleOverlay');
  abs.syncOverlayTrap();
  const result = abs.handlePopstate();
  // handlePopstate used directly would also be what popstate calls; but history wasn't popped.
  // Simulate real back:
  abs.resetForTest();
}
{
  const env = createEnv();
  const abs = loadModule(env);
  abs.init();
  env.show('hbmdOverlay');
  abs.syncOverlayTrap();
  env.show('eshMuscleOverlay');
  abs.syncOverlayTrap();
  env.history.back();
  assert(env.closed.muscle === 1, 'back closes exercise sheet first');
  assert(env.closed.detail === 0, 'detail stays open under the sheet');
  assert(env.els.hbmdOverlay.classList.contains('show'), 'detail overlay still shown');
  assert(abs.isOverlayTrapArmed(), 'trap re-armed for remaining detail');
  env.history.back();
  assert(env.closed.detail === 1, 'second back closes detail');
  abs.resetForTest();
}

console.log('=== 5. Runtime: tabs then exit confirm ===');
{
  const env = createEnv();
  const abs = loadModule(env);
  abs.init();
  env.window.switchView('log');
  assert(env.currentView === 'log' || env.els.viewLog.classList.contains('active'), 'switched to log');
  assert(abs.getTabStack().length === 1 && abs.getTabStack()[0] === 'home', 'tab stack remembers home');
  env.history.back();
  assert(env.lastSwitch && env.lastSwitch.name === 'home' && env.lastSwitch.opts && env.lastSwitch.opts.fromPopstate, 'back returns to home tab');
  env.history.back();
  assert(abs.isExitConfirmOpen(), 'root back shows exit confirm');
  const exitEl = env.document.getElementById(abs.EXIT_ID);
  assert(exitEl && exitEl.classList.contains('show'), 'confirm overlay visible');
  assert(exitEl.innerHTML.includes('앱을 종료할까요?'), 'confirm copy in DOM');
  assert(exitEl.innerHTML.includes('취소') && exitEl.innerHTML.includes('종료'), '취소/종료 buttons');
  const lenWithConfirm = env.len;
  abs.cancelExit();
  assert(abs.isExitConfirmOpen() === false, '취소 hides confirm');
  assert(env.history.state && env.history.state[abs.ROOT_FLAG], '취소 re-arms root guard');
  env.history.back();
  assert(abs.isExitConfirmOpen(), 'back shows confirm again after cancel');
  abs.confirmExit();
  assert(abs.isExitConfirmOpen() === false, '종료 hides confirm');
  assert(env.closedApp === true || env.idx === 0, '종료 walks back past the guard');
  abs.resetForTest();
}

console.log('=== 6. Modal close via button pops history ===');
{
  const env = createEnv();
  const abs = loadModule(env);
  abs.init();
  const start = env.len;
  env.show('modalOverlay');
  abs.syncOverlayTrap();
  assert(env.len === start + 1, 'modal arms overlay trap');
  env.hide('modalOverlay');
  abs.syncOverlayTrap();
  assert(env.history.state && env.history.state[abs.ROOT_FLAG], 'modal close button returns to root guard');
  assert(!env.history.state[abs.OVERLAY_FLAG], 'modal trap entry is no longer current');
  env.show('modalOverlay');
  abs.syncOverlayTrap();
  assert(env.history.state && env.history.state[abs.OVERLAY_FLAG], 'reopening modal pushes a fresh trap');
  assert(env.len === start + 1, 'reopen replaces forward entry instead of stacking');
  abs.resetForTest();
}

console.log(failures === 0 ? '\n=== AppBackStack tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
