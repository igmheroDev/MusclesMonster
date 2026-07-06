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
  setItem(k, v) { this._data[k] = v; },
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

const RestTimer = new Function(
  fs.readFileSync(path.join(__dirname, 'restTimer.js'), 'utf8') + '; return RestTimer;'
)();

assert(RestTimer.formatSeconds(90) === '1:30', 'format 90s');
assert(RestTimer.formatSeconds(65) === '1:05', 'format 65s');
assert(RestTimer.formatSeconds(0) === '0:00', 'format zero');

const defaultConfig = RestTimer.loadConfig();
assert(defaultConfig.enabled === true, 'default enabled');
assert(defaultConfig.seconds === 90, 'default seconds');

localStorage.setItem(SETTINGS_KEY, JSON.stringify({
  baseRecoveryHours: 48,
  restTimer: { enabled: false, seconds: 120 },
}));
const savedConfig = RestTimer.loadConfig();
assert(savedConfig.enabled === false, 'load disabled');
assert(savedConfig.seconds === 120, 'load custom seconds');

assert(Array.isArray(RestTimer.PRESETS) && RestTimer.PRESETS.includes(90), 'presets include 90');
assert(typeof RestTimer.init === 'function', 'init exists');
assert(typeof RestTimer.onModalClose === 'function', 'onModalClose exists');
assert(typeof RestTimer.start === 'function', 'start exists');

console.log(failures === 0 ? 'RestTimer tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
