#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const created = [];
global.document = {
  head: {
    appendChild(el) { created.push(el); },
  },
  documentElement: {
    appendChild(el) { created.push(el); },
    scrollTop: 0,
  },
  body: { scrollTop: 0 },
  scrollingElement: { scrollTop: 0 },
  getElementById(id) {
    return created.find((el) => el.id === id) || null;
  },
  createElement(tag) {
    return {
      tagName: tag,
      id: '',
      textContent: '',
    };
  },
  addEventListener() {},
};

global.CSS = {
  supports(prop, value) {
    return prop === 'overscroll-behavior-y' && value === 'none';
  },
};

const PullRefreshGuard = new Function(
  fs.readFileSync(path.join(__dirname, 'pullRefreshGuard.js'), 'utf8') + '; return PullRefreshGuard;'
)();

assert(typeof PullRefreshGuard.init === 'function', 'init exists');
assert(typeof PullRefreshGuard.ensureStyles === 'function', 'ensureStyles exists');
assert(typeof PullRefreshGuard.isActive === 'function', 'isActive exists');

PullRefreshGuard.init();
assert(PullRefreshGuard.isActive() === true, 'active after init');

const styleEl = document.getElementById('recovr-pull-refresh-guard');
assert(!!styleEl, 'style element injected');
assert(
  styleEl.textContent.includes('overscroll-behavior-y: none'),
  'css disables overscroll-y'
);
assert(
  styleEl.textContent.includes('overscroll-behavior: none'),
  'css disables overscroll'
);

// 중복 init 안전
PullRefreshGuard.init();
const styles = created.filter((el) => el.id === 'recovr-pull-refresh-guard');
assert(styles.length === 1, 'style injected once');

// 연결 점검: index / sw / app
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

assert(indexHtml.includes('pullRefreshGuard.js'), 'index loads module');
assert(
  indexHtml.includes('overscroll-behavior-y: none'),
  'index css disables pull-to-refresh'
);
assert(sw.includes('pullRefreshGuard.js'), 'sw caches module');
assert(sw.includes('recovr-cache-v73'), 'sw cache bump');
assert(app.includes('PullRefreshGuard.init()'), 'app init wires module');

console.log(failures === 0 ? 'PullRefreshGuard tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
