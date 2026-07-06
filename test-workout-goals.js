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

global.CardioTracker = {
  getWorkoutCardioMinutes(w) {
    if (w.type === 'cardio') return parseInt(w.duration, 10) || 0;
    return 0;
  },
};

const WorkoutGoals = new Function(
  fs.readFileSync(path.join(__dirname, 'workoutGoals.js'), 'utf8') + '; return WorkoutGoals;'
)();

const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const d = String(now.getDate()).padStart(2, '0');
const today = `${y}-${m}-${d}`;

const workouts = [
  { date: today, type: 'upper', exercises: [] },
  { date: today, type: 'cardio', duration: 30, exercises: [] },
  { date: `${y}-${m}-01`, type: 'lower', exercises: [] },
  { date: '2020-01-01', type: 'full', exercises: [] },
];

const stats = WorkoutGoals.getMonthlyStats(workouts, now);
assert(stats.sessionCount === 3, 'monthly session count');
assert(stats.cardioMinutes === 30, 'monthly cardio minutes');

WorkoutGoals.saveGoals({ workoutEnabled: true, workoutTarget: 10, cardioEnabled: true, cardioTarget: 500 });
const goals = WorkoutGoals.loadGoals();
assert(goals.workoutEnabled === true, 'workout enabled saved');
assert(goals.workoutTarget === 10, 'workout target saved');
assert(goals.cardioTarget === 500, 'cardio target saved');
assert(WorkoutGoals.hasAnyGoal(goals) === true, 'has any goal');

assert(WorkoutGoals.calcPct(5, 10) === 50, 'calc pct 50');
assert(WorkoutGoals.calcPct(12, 10) === 100, 'calc pct capped 100');

WorkoutGoals.saveGoals({ workoutEnabled: false, cardioEnabled: false });
assert(WorkoutGoals.hasAnyGoal() === false, 'no goals when disabled');

console.log(failures === 0 ? 'WorkoutGoals tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
