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
    getAttribute(k) { return this._attrs[k]; },
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
    focus() { el._focused = true; },
  };
  Object.defineProperty(el, 'dataset', {
    get() {
      const d = {};
      Object.keys(el._attrs).forEach((k) => {
        if (k.startsWith('data-')) {
          const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          d[camel] = el._attrs[k];
        }
      });
      return d;
    },
  });
  Object.defineProperty(el, 'textContent', {
    get() { return el._text || ''; },
    set(v) { el._text = String(v); },
  });
  return el;
}

function matches(node, sel) {
  if (!node) return false;
  if (sel === '#' + node.id) return true;
  if (sel === '[data-hmt-mode]') return !!node.getAttribute('data-hmt-mode');
  if (sel === '[data-hmt-panel]') return !!node.getAttribute('data-hmt-panel');
  if (sel.startsWith('.') && node.classList) return node.classList.contains(sel.slice(1));
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

const host = makeEl('div');
host.id = 'heatmapModeHost';
host.classList.add('hmt-host');

const tablist = makeEl('div');
tablist.classList.add('hmt-tabs');
tablist.setAttribute('role', 'tablist');

function makeTab(mode, label, selected) {
  const btn = makeEl('button');
  btn.classList.add('hmt-tab');
  if (selected) btn.classList.add('selected');
  btn.setAttribute('data-hmt-mode', mode);
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  btn.textContent = label;
  tablist.appendChild(btn);
  return btn;
}
const recoveryTab = makeTab('recovery', '회복', true);
const growthTab = makeTab('growth', '성장·손실', false);

const recoveryPanel = makeEl('div');
recoveryPanel.id = 'muscleHeatmapCard';
recoveryPanel.setAttribute('data-hmt-panel', 'recovery');
recoveryPanel.setAttribute('role', 'tabpanel');

const growthPanel = makeEl('div');
growthPanel.id = 'muscleGrowthHeatmapCard';
growthPanel.setAttribute('data-hmt-panel', 'growth');
growthPanel.setAttribute('role', 'tabpanel');
growthPanel.setAttribute('hidden', '');

host.appendChild(tablist);
host.appendChild(recoveryPanel);
host.appendChild(growthPanel);

const head = makeEl('head');

global.document = {
  readyState: 'loading',
  head,
  documentElement: makeEl('html'),
    getElementById(id) {
      if (id === 'heatmapModeHost') return host;
      if (id === 'muscleGrowthHeatmapCard') return growthPanel;
      if (id === 'muscleHeatmapCard') return recoveryPanel;
      return createdElements.find((e) => e.id === id) || null;
    },
  createElement(tag) {
    const el = makeEl(tag);
    createdElements.push(el);
    return el;
  },
  addEventListener(type, fn) {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  },
};

const HeatmapModeTabs = new Function(
  fs.readFileSync(path.join(__dirname, 'heatmapModeTabs.js'), 'utf8') + '; return HeatmapModeTabs;'
)();

console.log('=== 1. 모듈 API · 탭은 히트맵 인근 ===');
assert(typeof HeatmapModeTabs.init === 'function', 'init');
assert(typeof HeatmapModeTabs.setMode === 'function', 'setMode');
assert(typeof HeatmapModeTabs.afterHomeRender === 'function', 'afterHomeRender');

const cfg = HeatmapModeTabs.getConfig();
assert(cfg.hostId === 'heatmapModeHost', 'host id');
assert(cfg.defaultMode === 'recovery', '기본 탭은 회복');
assert(cfg.recoveryPanelId === 'muscleHeatmapCard', '회복 패널 = 기존 회복 히트맵 컨테이너');
assert(cfg.growthPanelId === 'muscleGrowthHeatmapCard', '성장·손실 패널 = 기존 성장 히트맵 컨테이너');
assert(cfg.modes.join(',') === 'recovery,growth', '모드 2개');

console.log('=== 2. 스타일: 히트맵 바로 위, 홈 헤더/하단 네비 아님 ===');
assert(HeatmapModeTabs.ensureStyles() === true, 'ensureStyles');
const styleEl = document.getElementById('heatmap-mode-tabs-styles');
assert(!!styleEl, 'style 주입');
const css = String(styleEl.textContent || '');
assert(css.includes('.hmt-host'), 'host 스타일');
assert(css.includes('.hmt-tabs'), '탭바');
assert(css.includes('min-height: 44px'), '모바일 터치 영역');
assert(!css.includes('position: fixed'), '고정 상단 메뉴가 아님');
assert(!css.includes('.nav-item') && !css.includes('BOTTOM NAV'), '하단 네비에 붙이지 않음');

console.log('=== 3. 탭 전환 시 한쪽 패널만 보임 ===');
assert(HeatmapModeTabs.init() === true, 'init ok');
assert(HeatmapModeTabs.setMode('recovery') === 'recovery', '회복 선택');
assert(!recoveryPanel.getAttribute('hidden'), '회복 패널 표시');
assert(growthPanel.getAttribute('hidden') === '', '성장 패널 숨김');
assert(recoveryTab.getAttribute('aria-selected') === 'true', '회복 탭 선택');
assert(growthTab.getAttribute('aria-selected') === 'false', '성장 탭 비선택');

assert(HeatmapModeTabs.setMode('growth') === 'growth', '성장·손실 선택');
assert(recoveryPanel.getAttribute('hidden') === '', '회복 패널 숨김');
assert(!growthPanel.getAttribute('hidden'), '성장 패널 표시');

host._listeners.filter((l) => l[0] === 'click').forEach((l) => {
  l[1]({
    target: recoveryTab,
    preventDefault() {},
  });
});
assert(!recoveryPanel.getAttribute('hidden'), '클릭으로 회복 복귀');

console.log('=== 3b. 성장 데이터 없을 때도 패널이 비지 않음 ===');
growthPanel.children = [];
delete growthPanel.innerHTML;
HeatmapModeTabs.afterHomeRender();
assert(String(growthPanel.innerHTML || '').includes('근성장 · 근손실 히트맵'), '빈 성장 패널에 안내 카드');

console.log('=== 4. 기존 히트맵 모듈은 수정하지 않음 ===');
const mh = fs.readFileSync(path.join(__dirname, 'muscleHeatmap.js'), 'utf8');
const mgd = fs.readFileSync(path.join(__dirname, 'muscleGrowthDetail.js'), 'utf8');
const esh = fs.readFileSync(path.join(__dirname, 'exerciseStimHeatmap.js'), 'utf8');
assert(!mh.includes('HeatmapModeTabs'), 'muscleHeatmap.js 미참조');
assert(!mgd.includes('HeatmapModeTabs'), 'muscleGrowthDetail.js 미참조');
assert(!esh.includes('HeatmapModeTabs'), 'exerciseStimHeatmap.js 미참조');
assert(mh.includes("getElementById('muscleHeatmapCard')"), '회복 히트맵은 기존 컨테이너에 렌더');
assert(mgd.includes("getElementById('muscleGrowthHeatmapCard')"), '성장 히트맵은 기존 컨테이너에 렌더');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(indexHtml.includes('id="heatmapModeHost"'), '히트맵 인근 호스트');
assert(indexHtml.includes('id="muscleHeatmapCard"'), '회복 컨테이너 유지');
assert(indexHtml.includes('id="muscleGrowthHeatmapCard"'), '성장 컨테이너 유지');
assert(indexHtml.includes('<script src="heatmapModeTabs.js"></script>'), '스크립트 등록');

const hostIdx = indexHtml.indexOf('id="heatmapModeHost"');
const logoIdx = indexHtml.indexOf('class="logo"');
const navIdx = indexHtml.indexOf('<!-- ===================== BOTTOM NAV');
assert(hostIdx > logoIdx, '히트맵 호스트는 로고/헤더보다 아래');
assert(hostIdx < navIdx, '히트맵 호스트는 하단 네비보다 위');

const growthCardIdx = indexHtml.indexOf('id="muscleGrowthCard"');
assert(hostIdx > growthCardIdx, '탭은 근성장 숫자 카드 다음 = 히트맵 인근');
const listIdx = indexHtml.indexOf('id="muscleList"');
assert(indexHtml.indexOf('id="muscleHeatmapCard"') < listIdx, '회복 히트맵이 목록보다 위(호스트 안)');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(appJs.includes('HeatmapModeTabs.afterHomeRender()'), 'renderHome 이후 탭 동기화 훅');

const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(swJs.includes("'./heatmapModeTabs.js'"), 'sw ASSETS');
assert(swJs.includes("'/heatmapModeTabs.js'"), 'sw NETWORK_FIRST');
assert(swJs.includes('recovr-cache-v76'), 'sw cache bump');

HeatmapModeTabs.destroy();

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
