#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const DurationAutoSave = new Function(
  fs.readFileSync(path.join(__dirname, 'durationAutoSave.js'), 'utf8') + '; return DurationAutoSave;'
)();

assert(DurationAutoSave.INTERVAL_MS === 30000, 'interval 30s');
assert(typeof DurationAutoSave.init === 'function', 'init exists');
assert(typeof DurationAutoSave.tick === 'function', 'tick exists');
assert(typeof DurationAutoSave.isStopwatchRunning === 'function', 'isStopwatchRunning exists');

// DOM 없을 때 false
assert(DurationAutoSave.isStopwatchRunning() === false, 'no DOM → not running');

console.log(failures === 0 ? 'DurationAutoSave tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
