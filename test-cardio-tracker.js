#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// app.js 의존 함수 모킹
const MUSCLE_KEYWORDS = { cardio: ['로잉머신', '천국의 계단', '러닝'] };
const NON_MUSCLE_ORDER = ['cardio'];

function normalizeExerciseName(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '');
}

function matchKeywordCategories(name, categories) {
  const norm = normalizeExerciseName(name);
  const hits = [];
  categories.forEach(cat => {
    (MUSCLE_KEYWORDS[cat] || []).forEach(kw => {
      if (norm.includes(normalizeExerciseName(kw))) hits.push({ cat, kw, len: kw.length });
    });
  });
  hits.sort((a, b) => b.len - a.len);
  const seen = new Set();
  return hits.filter(h => { if (seen.has(h.cat)) return false; seen.add(h.cat); return true; }).map(h => h.cat);
}

function getActivityTagsFromExerciseName(name) {
  return matchKeywordCategories(name, NON_MUSCLE_ORDER);
}

const DurationTimer = new Function(
  fs.readFileSync(path.join(__dirname, 'durationTimer.js'), 'utf8') + '; return DurationTimer;'
)();

const CardioTracker = new Function(
  'DurationTimer', 'getActivityTagsFromExerciseName',
  fs.readFileSync(path.join(__dirname, 'cardioTracker.js'), 'utf8') + '; return CardioTracker;'
)(DurationTimer, getActivityTagsFromExerciseName);

const rowing = { name: '로잉머신', mode: 'duration', durationSets: [{ seconds: 900, completed: true }] };
assert(CardioTracker.isCardioExercise(rowing), 'rowing is cardio');
assert(!CardioTracker.isCardioExercise({ name: '벤치 프레스', weight: 60, reps: 10 }), 'bench is not cardio');

assert(CardioTracker.getExerciseMinutes(rowing) === 15, 'rowing 15 min');

const workout = {
  type: 'cardio',
  date: '2026-06-24',
  duration: 30,
  exercises: [rowing, { name: '천국의 계단', mode: 'duration', durationSets: [{ seconds: 1200, completed: true }] }],
};
assert(CardioTracker.isCardioWorkout(workout), 'cardio workout detected');
assert(CardioTracker.getWorkoutCardioMinutes(workout) === 35, 'total cardio minutes');

const workouts = [
  workout,
  { type: 'upper', date: '2026-06-23', exercises: [{ name: '스쿼트', weight: 100, reps: 5 }] },
];
const stats = CardioTracker.getWeeklyStats(workouts, 7);
assert(stats.sessionCount === 1, 'one cardio session');
assert(stats.totalMinutes === 35, 'weekly total minutes');
assert(stats.byMachine['로잉머신'] === 15, 'machine breakdown');

assert(CardioTracker.formatMinutes(90) === '1시간 30분', 'format 90 min');
assert(CardioTracker.PRESETS.some(p => p.name === '천국의 계단'), 'stair preset exists');
assert(CardioTracker.PRESETS.some(p => p.name === '로잉머신'), 'rowing preset exists');

console.log(failures === 0 ? 'CardioTracker tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
