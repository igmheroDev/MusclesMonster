#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const WorkoutUtils = new Function(
  fs.readFileSync(path.join(__dirname, 'workoutUtils.js'), 'utf8') + '; return WorkoutUtils;'
)();

assert(WorkoutUtils.UPPER_MUSCLES.includes('forearms'), 'upper includes forearms');
assert(WorkoutUtils.LOWER_MUSCLES.includes('quads'), 'lower includes quads');
assert(WorkoutUtils.UPPER_MUSCLES.length === 6, 'upper muscle count');

const today = new Date();
const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const workouts = [
  { date: fmt(today), exercises: [] },
  { date: fmt(new Date(today.getTime() - 5 * 86400000)), exercises: [] },
  { date: fmt(new Date(today.getTime() - 20 * 86400000)), exercises: [] },
];

const recent7 = WorkoutUtils.getWorkoutsInLookback(workouts, 7);
assert(recent7.length === 2, 'lookback 7 days filters old workout');

const recent30 = WorkoutUtils.getWorkoutsInLookback(workouts, 30);
assert(recent30.length === 3, 'lookback 30 days includes all');

assert(WorkoutUtils.getWorkoutsInLookback([], 7).length === 0, 'empty workouts');

console.log(failures === 0 ? 'WorkoutUtils tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
