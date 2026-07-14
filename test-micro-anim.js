#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// Minimal DOM stubs for module load + API tests
const listeners = {};
const createdElements = [];

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    style: {},
    children: [],
    parentNode: null,
    offsetWidth: 10,
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 40 };
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
  };
  let className = '';
  const syncSet = () => new Set(className.split(/\s+/).filter(Boolean));
  Object.defineProperty(el, 'className', {
    get() { return className; },
    set(v) { className = String(v || ''); },
  });
  el.classList = {
    add(c) { const s = syncSet(); s.add(c); className = [...s].join(' '); },
    remove(c) { const s = syncSet(); s.delete(c); className = [...s].join(' '); },
    contains(c) { return syncSet().has(c); },
    toggle(c) {
      if (this.contains(c)) this.remove(c);
      else this.add(c);
    },
  };
  createdElements.push(el);
  return el;
}

global.window = {
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

const MicroAnim = new Function(
  fs.readFileSync(path.join(__dirname, 'microAnim.js'), 'utf8') + '; return MicroAnim;'
)();

assert(typeof MicroAnim.init === 'function', 'init exists');
assert(typeof MicroAnim.pop === 'function', 'pop exists');
assert(typeof MicroAnim.ripple === 'function', 'ripple exists');
assert(typeof MicroAnim.stamp === 'function', 'stamp exists');
assert(typeof MicroAnim.successPulse === 'function', 'successPulse exists');
assert(typeof MicroAnim.celebrateMissionCard === 'function', 'celebrateMissionCard exists');
assert(typeof MicroAnim.prefersReducedMotion === 'function', 'prefersReducedMotion exists');

const cfg = MicroAnim.getConfig();
assert(cfg.styleId === 'micro-anim-styles', 'style id');
assert(cfg.popMs === 320, 'pop duration');
assert(cfg.checkSelectors.includes('.set-check'), 'watches set-check');
assert(cfg.checkSelectors.includes('.duration-check'), 'watches duration-check');
assert(cfg.checkSelectors.includes('.dm-mission-check'), 'watches mission check');
assert(cfg.rippleSelectors.includes('.save-btn'), 'ripple on save');
assert(cfg.pressSelectors.includes('.nav-item'), 'press on nav');

assert(MicroAnim.prefersReducedMotion() === false, 'default reduced motion off');

const target = makeEl('div');
assert(MicroAnim.pop(target) === true, 'pop returns true');
assert(target.classList.contains('ma-pop'), 'pop adds ma-pop');
assert(target.classList.contains('ma-check-flash'), 'pop adds flash');

const btn = makeEl('button');
assert(MicroAnim.ripple(btn, 20, 10) === true, 'ripple returns true');
assert(btn.classList.contains('ma-ripple-host'), 'ripple host class');
assert(btn.children.length === 1, 'ripple ink appended');
assert(btn.children[0].classList.contains('ma-ripple'), 'ink has ma-ripple');

MicroAnim.ensureStyles();
const styleEl = document.getElementById('micro-anim-styles');
assert(!!styleEl, 'styles injected');
assert(String(styleEl.textContent || styleEl._text || '').includes('@keyframes ma-pop'), 'keyframes present');

assert(MicroAnim.init() === true || MicroAnim.init() === false, 'init callable');
// already auto-inited on load in stub with readyState complete
MicroAnim.destroy();
assert(true, 'destroy ok');

console.log(failures === 0 ? 'MicroAnim tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
