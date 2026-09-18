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
    className: '',
    style: {},
    children: [],
    parentNode: null,
    _attrs: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); el.className = Array.from(this._set).join(' '); },
      remove(c) { this._set.delete(c); el.className = Array.from(this._set).join(' '); },
      contains(c) { return this._set.has(c); },
    },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k]; },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    querySelector(sel) { return findAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return findAll(el, sel); },
  };
  Object.defineProperty(el, 'textContent', {
    get() { return el._text || ''; },
    set(v) { el._text = String(v); },
  });
  return el;
}

function matches(node, sel) {
  if (sel === 'nav') return node.tagName === 'NAV';
  if (sel === 'style') return node.tagName === 'STYLE';
  if (sel === '.nav-item[data-view]') {
    return node.classList.contains('nav-item') && !!node.getAttribute('data-view');
  }
  if (sel.startsWith('.') && !sel.includes('[')) {
    return node.classList.contains(sel.slice(1));
  }
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

const nav = makeEl('nav');
function makeTab(view, active) {
  const item = makeEl('div');
  item.classList.add('nav-item');
  item.setAttribute('data-view', view);
  if (active) item.classList.add('active');
  const icon = makeEl('div');
  icon.classList.add('ni-icon');
  item.appendChild(icon);
  nav.appendChild(item);
  return item;
}
const homeTab = makeTab('home', true);
const logTab = makeTab('log', false);
const fab = makeEl('div');
fab.classList.add('nav-item');
fab.classList.add('fab');
nav.appendChild(fab);
makeTab('stats', false);
makeTab('settings', false);

const head = makeEl('head');
const documentElement = makeEl('html');

global.MutationObserver = function MutationObserver() {
  this.observe = () => {};
  this.disconnect = () => {};
};

global.document = {
  readyState: 'loading',
  head,
  documentElement,
  getElementById(id) {
    return createdElements.find((e) => e.id === id) || null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    createdElements.push(el);
    return el;
  },
  querySelector(sel) {
    if (sel === 'nav') return nav;
    return null;
  },
  querySelectorAll(sel) {
    if (sel === '.nav-item[data-view]') {
      return [homeTab, logTab, nav.children[3], nav.children[4]];
    }
    return [];
  },
  addEventListener(type, fn) {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  },
};

const NavTabHighlight = new Function(
  fs.readFileSync(path.join(__dirname, 'navTabHighlight.js'), 'utf8') + '; return NavTabHighlight;'
)();

console.log('=== 1. 모듈 API ===');
assert(typeof NavTabHighlight.init === 'function', 'init');
assert(typeof NavTabHighlight.destroy === 'function', 'destroy');
assert(typeof NavTabHighlight.ensureStyles === 'function', 'ensureStyles');
assert(typeof NavTabHighlight.syncAriaCurrent === 'function', 'syncAriaCurrent');
assert(typeof NavTabHighlight.getConfig === 'function', 'getConfig');

const cfg = NavTabHighlight.getConfig();
assert(cfg.styleId === 'nav-tab-highlight-styles', 'style id');
assert(cfg.itemSelector === '.nav-item[data-view]', 'FAB 제외용 data-view 셀렉터');
assert(cfg.tabAccents.home === 'green', '홈 액센트');
assert(cfg.tabAccents.log === 'cyan', '기록 액센트');
assert(cfg.tabAccents.stats === 'violet', '통계 액센트');
assert(cfg.tabAccents.settings === 'orange', '설정 액센트');

console.log('=== 2. 스타일 주입 (홈/기록 구분용 컬러) ===');
assert(NavTabHighlight.ensureStyles() === true, 'ensureStyles ok');
const styleEl = document.getElementById('nav-tab-highlight-styles');
assert(!!styleEl, 'style 태그 주입');
const css = String(styleEl.textContent || '');
assert(css.includes('nav .nav-item[data-view].active'), 'active 탭 스타일');
assert(css.includes('data-view="home"'), '홈 탭 액센트');
assert(css.includes('data-view="log"'), '기록 탭 액센트');
assert(css.includes('--nth-accent: var(--green)'), '홈 = 그린');
assert(css.includes('--nth-accent: var(--cyan)'), '기록 = 시안');
assert(css.includes('::before'), '상단 인디케이터 바');
assert(css.includes('::after'), '아이콘 주변 컴팩트 필');
assert(css.includes('background: var(--nth-fill)'), '선택 탭 배경 필');
assert(css.includes('width: 64px'), '필이 화면 가로로 늘어나지 않음');
assert(!css.includes('.nav-item.fab.active'), 'FAB 활성 컬러를 덮어쓰지 않음');
assert(NavTabHighlight.ensureStyles() === true, '중복 주입 없이 재호출 가능');
assert(createdElements.filter((e) => e.id === 'nav-tab-highlight-styles').length === 1, 'style 태그 1개만');

console.log('=== 3. aria-current 동기화 (기존 .active 클래스만 읽음) ===');
assert(NavTabHighlight.syncAriaCurrent(nav) === 1, '홈만 활성');
assert(homeTab.getAttribute('aria-current') === 'page', '홈에 aria-current');
assert(!logTab.getAttribute('aria-current'), '기록에는 aria-current 없음');
assert(!fab.getAttribute('aria-current'), 'FAB는 data-view가 없어 대상 아님');

homeTab.classList.remove('active');
logTab.classList.add('active');
assert(NavTabHighlight.syncAriaCurrent(nav) === 1, '기록만 활성');
assert(!homeTab.getAttribute('aria-current'), '홈 aria-current 해제');
assert(logTab.getAttribute('aria-current') === 'page', '기록에 aria-current');

console.log('=== 4. 기존 모듈을 수정하지 않음 ===');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(!appJs.includes('NavTabHighlight'), 'app.js는 NavTabHighlight를 호출하지 않음');
assert(appJs.includes("document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))"), 'switchView의 active 토글은 그대로');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(indexHtml.includes('data-view="home"'), '홈 탭 마크업 유지');
assert(indexHtml.includes('data-view="log"'), '기록 탭 마크업 유지');
assert(indexHtml.includes('<script src="navTabHighlight.js"></script>'), 'index.html 스크립트 등록');

const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(swJs.includes("'./navTabHighlight.js'"), 'sw ASSETS');
assert(swJs.includes("'/navTabHighlight.js'"), 'sw NETWORK_FIRST');
assert(swJs.includes('recovr-cache-v75'), 'sw cache bump');

assert(NavTabHighlight.init() === true, '첫 init');
assert(NavTabHighlight.init() === false, '중복 init 방지');
NavTabHighlight.destroy();

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
