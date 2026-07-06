#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

global.CardioTracker = {
  isCardioExercise(ex) {
    return ex?.mode === 'duration' && /러닝|로잉|자전거/.test(ex.name || '');
  },
};

global.selectedType = 'cardio';

const CardioMetrics = new Function(
  fs.readFileSync(path.join(__dirname, 'cardioMetrics.js'), 'utf8') + '; return CardioMetrics;'
)();

const ex = {
  name: '트레드밀 러닝',
  mode: 'duration',
  cardioMetrics: { distanceKm: 5.2, calories: 320, avgHeartRate: 145 },
};

const normalized = CardioMetrics.normalizeMetrics(ex);
assert(normalized.distanceKm === 5.2, 'distance');
assert(normalized.calories === 320, 'calories');
assert(normalized.avgHeartRate === 145, 'hr');

assert(CardioMetrics.formatSummary(ex) === '5.2km · 320kcal · 심박 145', 'format summary');
assert(CardioMetrics.hasAny(normalized), 'has any');

const stored = CardioMetrics.toStored({ distanceKm: 3, calories: 0, avgHeartRate: 0 });
assert(stored.distanceKm === 3 && !stored.calories, 'toStored partial');

const today = new Date();
const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const workouts = [{
  date: fmt(today),
  type: 'cardio',
  exercises: [ex, {
    name: '실내자전거',
    mode: 'duration',
    cardioMetrics: { distanceKm: 0, calories: 180, avgHeartRate: 130 },
  }],
}];

const agg = CardioMetrics.aggregatePeriod(workouts, 7);
assert(agg.distanceKm === 5.2, 'agg distance');
assert(agg.calories === 500, 'agg calories');
assert(agg.avgHeartRate === 138, 'agg avg hr'); // (145+130)/2
assert(agg.metricSessions === 2, 'metric sessions');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(appJs.includes('CardioMetrics.onRowAdded'), 'app onRowAdded hook');
assert(appJs.includes('CardioMetrics.readFromWrap'), 'app readFromWrap hook');
assert(appJs.includes('CardioMetrics.renderStatsCard'), 'app stats hook');

console.log(failures === 0 ? 'CardioMetrics tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
