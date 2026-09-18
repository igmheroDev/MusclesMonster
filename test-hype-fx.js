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
    disabled: false,
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

const HypeFx = new Function(
  fs.readFileSync(path.join(__dirname, 'hypeFx.js'), 'utf8') + '; return HypeFx;'
)();

assert(typeof HypeFx.init === 'function', 'init exists');
assert(typeof HypeFx.hypeOnCheck === 'function', 'hypeOnCheck exists');
assert(typeof HypeFx.hypeOnSave === 'function', 'hypeOnSave exists');
assert(typeof HypeFx.prefersReducedMotion === 'function', 'prefersReducedMotion exists');

const cfg = HypeFx.getConfig();
assert(cfg.styleId === 'hype-fx-styles', 'style id');
assert(cfg.layerId === 'hypeFxLayer', 'layer id');
assert(cfg.checkCooldownMs >= 1000, 'check cooldown sane');
assert(cfg.saveCooldownMs >= 1000, 'save cooldown sane');
assert(cfg.checkPhraseCount >= 6, 'has a good variety of check phrases');
assert(cfg.savePhraseCount >= 6, 'has a good variety of save phrases');

HypeFx.ensureStyles();
assert(!!document.getElementById('hype-fx-styles'), 'styles injected');
assert(String(document.getElementById('hype-fx-styles').textContent).includes('hfx-bubble'), 'bubble css present');

const anchor = makeEl('div');
const layer = () => document.getElementById('hypeFxLayer');

assert(HypeFx.hypeOnCheck(anchor) === true, 'first check hype fires');
assert(!!layer() && layer().children.length === 1, 'check bubble appended');
assert(typeof layer().children[0].textContent === 'string' && layer().children[0].textContent.length > 0, 'bubble has text');

// 쿨다운 안에는 다시 뜨지 않는다
assert(HypeFx.hypeOnCheck(anchor) === false, 'cooldown blocks repeated check hype');
assert(layer().children.length === 1, 'no extra bubble appended during cooldown');

// 쿨다운이 지나면 다시 뜬다
const originalNow = Date.now;
try {
  Date.now = () => originalNow() + 10000;
  assert(HypeFx.hypeOnCheck(anchor) === true, 'check hype fires again after cooldown');
} finally {
  Date.now = originalNow;
}

assert(HypeFx.hypeOnSave() === true, 'save hype fires');
assert(HypeFx.hypeOnSave() === false, 'save cooldown blocks repeat');

assert(HypeFx.prefersReducedMotion() === false, 'reduced motion default off');
HypeFx.destroy();

// static wiring checks
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(html.includes('hypeFx.js'), 'html script');
assert(sw.includes('hypeFx.js'), 'sw asset');
assert(sw.includes('recovr-cache-v75'), 'sw cache bump');

console.log(failures === 0 ? 'HypeFx tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
