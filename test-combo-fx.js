#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const createdElements = [];
const listeners = {};

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    style: {},
    children: [],
    parentNode: null,
    offsetWidth: 10,
    innerHTML: '',
    textContent: '',
    getBoundingClientRect() {
      return { left: 40, top: 80, width: 28, height: 28 };
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentNode = null;
      return child;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    addEventListener() {},
  };
  let className = '';
  const sync = () => new Set(className.split(/\s+/).filter(Boolean));
  Object.defineProperty(el, 'className', {
    get() { return className; },
    set(v) { className = String(v || ''); },
  });
  el.classList = {
    add(c) { const s = sync(); s.add(c); className = [...s].join(' '); },
    remove(c) { const s = sync(); s.delete(c); className = [...s].join(' '); },
    contains(c) { return sync().has(c); },
    toggle(c) { if (this.contains(c)) this.remove(c); else this.add(c); },
  };
  createdElements.push(el);
  return el;
}

global.window = {
  innerWidth: 390,
  innerHeight: 844,
  matchMedia(query) {
    return {
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  },
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  requestAnimationFrame(cb) { return setTimeout(cb, 0); },
};

try {
  Object.defineProperty(global, 'navigator', {
    value: { vibrate() { return true; } },
    configurable: true,
  });
} catch (e) {
  global.navigator.vibrate = () => true;
}

global.document = {
  readyState: 'complete',
  head: makeEl('head'),
  body: makeEl('body'),
  getElementById(id) {
    return createdElements.find((e) => e.id === id) || null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    if (tag === 'style') {
      Object.defineProperty(el, 'textContent', {
        set(v) { el._text = v; },
        get() { return el._text || ''; },
      });
    }
    return el;
  },
  addEventListener(type, fn) {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  },
  removeEventListener(type, fn) {
    listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};

const ComboFx = new Function(
  fs.readFileSync(path.join(__dirname, 'comboFx.js'), 'utf8') + '; return ComboFx;'
)();

assert(typeof ComboFx.init === 'function', 'init exists');
assert(typeof ComboFx.registerCheck === 'function', 'registerCheck exists');
assert(typeof ComboFx.getCombo === 'function', 'getCombo exists');
assert(typeof ComboFx.resetCombo === 'function', 'resetCombo exists');
assert(typeof ComboFx.prefersReducedMotion === 'function', 'prefersReducedMotion exists');

const cfg = ComboFx.getConfig();
assert(cfg.styleId === 'combo-fx-styles', 'style id');
assert(cfg.layerId === 'comboFxLayer', 'layer id');
assert(cfg.comboWindowMs >= 1000, 'combo window sane');
assert(cfg.tierCount >= 3, 'has escalating tiers');
assert(cfg.checkSelectors.includes('.set-check'), 'watches set-check');
assert(cfg.checkSelectors.includes('.duration-check'), 'watches duration-check');

ComboFx.ensureStyles();
assert(!!document.getElementById('combo-fx-styles'), 'styles injected');
assert(String(document.getElementById('combo-fx-styles').textContent).includes('cbf-combo'), 'combo css present');

// 1콤보는 팝업 없이 카운트만 증가
ComboFx.resetCombo();
const anchor = makeEl('div');
const layer1 = () => document.getElementById('comboFxLayer');

let n = ComboFx.registerCheck(anchor);
assert(n === 1, 'first check is combo 1');
const layerAfterFirst = layer1();
assert(!layerAfterFirst || layerAfterFirst.children.length === 0, 'no popup on combo 1');

n = ComboFx.registerCheck(anchor);
assert(n === 2, 'second consecutive check is combo 2');
assert(layer1().children.length >= 1, 'popup appended on combo 2');

n = ComboFx.registerCheck(anchor);
n = ComboFx.registerCheck(anchor);
n = ComboFx.registerCheck(anchor);
n = ComboFx.registerCheck(anchor);
n = ComboFx.registerCheck(anchor);
n = ComboFx.registerCheck(anchor);
n = ComboFx.registerCheck(anchor);
n = ComboFx.registerCheck(anchor);
assert(n === 10, 'combo escalates to 10 with consecutive checks');
assert(ComboFx.getCombo() === 10, 'getCombo reflects current streak');

// 시간 창을 벗어나면 콤보가 끊긴다
const originalNow = Date.now;
try {
  Date.now = () => originalNow() + 10000;
  n = ComboFx.registerCheck(anchor);
  assert(n === 1, 'combo resets to 1 after window elapses');
} finally {
  Date.now = originalNow;
}

ComboFx.resetCombo();
assert(ComboFx.getCombo() === 0, 'resetCombo clears streak');

assert(ComboFx.prefersReducedMotion() === false, 'reduced motion default off');
ComboFx.destroy();

// static wiring checks
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(html.includes('comboFx.js'), 'html script');
assert(sw.includes('comboFx.js'), 'sw asset');
assert(sw.includes('recovr-cache-v66'), 'sw cache bump');

console.log(failures === 0 ? 'ComboFx tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
