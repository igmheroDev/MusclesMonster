#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const SETTINGS_KEY = 'recovr_settings_v1';
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
};

global.loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { baseRecoveryHours: 48 };
  } catch (e) {
    return { baseRecoveryHours: 48 };
  }
};

global.saveSettingsToStorage = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// Node 환경의 navigator는 getter-only일 수 있어 안전하게 스텁
try {
  Object.defineProperty(global, 'navigator', {
    value: {},
    configurable: true,
    writable: true,
  });
} catch (_) {
  /* ignore */
}

global.document = {
  visibilityState: 'visible',
  getElementById() { return null; },
  addEventListener() {},
};

const WakeLock = new Function(
  fs.readFileSync(path.join(__dirname, 'wakeLock.js'), 'utf8') + '; return WakeLock;'
)();

assert(typeof WakeLock.init === 'function', 'init exists');
assert(typeof WakeLock.request === 'function', 'request exists');
assert(typeof WakeLock.release === 'function', 'release exists');
assert(typeof WakeLock.sync === 'function', 'sync exists');
assert(typeof WakeLock.saveFromForm === 'function', 'saveFromForm exists');
assert(typeof WakeLock.fillForm === 'function', 'fillForm exists');

assert(WakeLock.isSupported() === false, 'unsupported without wakeLock API');

const defaultConfig = WakeLock.loadConfig();
assert(defaultConfig.enabled === true, 'default enabled');

localStorage.setItem(SETTINGS_KEY, JSON.stringify({
  baseRecoveryHours: 48,
  wakeLock: { enabled: false },
}));
assert(WakeLock.loadConfig().enabled === false, 'load disabled');

WakeLock.saveConfig({ enabled: true });
assert(WakeLock.loadConfig().enabled === true, 'saveConfig enables');

const hint = WakeLock.getStatusHint();
assert(typeof hint === 'string' && hint.length > 0, 'status hint non-empty');
assert(hint.includes('지원하지 않'), 'hint mentions unsupported');

console.log(failures === 0 ? 'WakeLock tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
