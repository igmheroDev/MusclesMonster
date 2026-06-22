#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const DurationTimer = new Function(
  fs.readFileSync(path.join(__dirname, 'durationTimer.js'), 'utf8') + '; return DurationTimer;'
)();

assert(DurationTimer.formatSeconds(0) === '0:00', 'zero');
assert(DurationTimer.formatSeconds(65) === '1:05', '65 sec');
assert(DurationTimer.formatSeconds(125) === '2:05', '125 sec');

const legacy = DurationTimer.normalizeSets({ mode: 'duration', durationMin: 2 });
assert(legacy.length === 1 && legacy[0].seconds === 120, 'legacy durationMin');

const sets = DurationTimer.normalizeSets({
  mode: 'duration',
  durationSets: [{ seconds: 45, completed: true }, { seconds: 30, completed: false }],
});
assert(sets.length === 2 && sets[0].seconds === 45, 'durationSets');
assert(DurationTimer.totalSeconds(sets) === 75, 'total seconds');
assert(DurationTimer.totalMinutes(sets) === 2, 'total minutes ceil');

assert(
  DurationTimer.formatExerciseSummary({ durationSets: [{ seconds: 60, completed: true }, { seconds: 45, completed: true }] }) === '1:00 + 0:45',
  'summary multi set'
);

// readFromWrap는 실행 중 타이머를 멈추지 않아야 함 (API 존재 확인)
assert(typeof DurationTimer.readFromWrap === 'function', 'readFromWrap exists');
assert(typeof DurationTimer.freezeActiveTimer === 'function', 'freezeActiveTimer exists');

console.log(failures === 0 ? 'DurationTimer tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
