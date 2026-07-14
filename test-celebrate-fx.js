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
    style: {
      setProperty(k, v) { this[k] = v; },
    },
    children: [],
    parentNode: null,
    offsetWidth: 10,
    hidden: false,
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
    querySelector(sel) {
      if (sel === '#cfxStreak' || sel === '#cfxTitle' || sel === '#cfxSub') {
        return makeEl('div');
      }
      return null;
    },
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

const CelebrateFx = new Function(
  fs.readFileSync(path.join(__dirname, 'celebrateFx.js'), 'utf8') + '; return CelebrateFx;'
)();

assert(typeof CelebrateFx.init === 'function', 'init exists');
assert(typeof CelebrateFx.confettiBurst === 'function', 'confettiBurst exists');
assert(typeof CelebrateFx.floatXp === 'function', 'floatXp exists');
assert(typeof CelebrateFx.showMissionClear === 'function', 'showMissionClear exists');
assert(typeof CelebrateFx.workoutSaved === 'function', 'workoutSaved exists');
assert(typeof CelebrateFx.igniteStreakPill === 'function', 'igniteStreakPill exists');
assert(typeof CelebrateFx.showToast === 'function', 'showToast exists');

const cfg = CelebrateFx.getConfig();
assert(cfg.styleId === 'celebrate-fx-styles', 'style id');
assert(cfg.overlayId === 'celebrateFxOverlay', 'overlay id');
assert(cfg.confettiCount === 42, 'confetti count');
assert(cfg.colors.length >= 4, 'palette');
assert(cfg.cooldownMs >= 1000, 'cooldown');

CelebrateFx.ensureStyles();
assert(!!document.getElementById('celebrate-fx-styles'), 'styles injected');
assert(String(document.getElementById('celebrate-fx-styles').textContent).includes('cfx-confetti'), 'confetti css');

assert(CelebrateFx.confettiBurst({ count: 5 }) === true, 'confetti runs');
const layer = document.getElementById('celebrateFxLayer');
assert(!!layer, 'layer created');
assert(layer.children.length >= 5, 'confetti pieces appended');

const anchor = makeEl('div');
assert(CelebrateFx.floatXp(anchor, '+1 세트') === true, 'xp float');

assert(CelebrateFx.showToast('운동 기록 완료') === true, 'toast');
assert(CelebrateFx.showMissionClear({ streak: 3, title: '미션 클리어!' }) === true, 'mission clear');
assert(!!document.getElementById('celebrateFxOverlay'), 'overlay created');
assert(document.getElementById('celebrateFxOverlay').classList.contains('show'), 'overlay shown');

assert(CelebrateFx.showMissionClear({ streak: 3 }) === false, 'cooldown blocks spam');

CelebrateFx.hideMissionClear();
assert(!document.getElementById('celebrateFxOverlay').classList.contains('show'), 'overlay hidden');

assert(CelebrateFx.prefersReducedMotion() === false, 'reduced motion default off');
CelebrateFx.destroy();

// static wiring checks
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(html.includes('celebrateFx.js'), 'html script');
assert(sw.includes('celebrateFx.js'), 'sw asset');
assert(sw.includes('recovr-cache-v52'), 'sw cache bump');

console.log(failures === 0 ? 'CelebrateFx tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
