#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

global.MUSCLE_LABELS = {
  chest: { name: '가슴' },
  shoulder: { name: '어깨' },
  triceps: { name: '삼두' },
  back: { name: '등' },
  biceps: { name: '이두' },
};

global.ExerciseMuscleMap = {
  getStimulation(name) {
    if (String(name).includes('벤치')) return { chest: 3, triceps: 2, shoulder: 2 };
    return {};
  },
};

global.getExerciseVolume = (ex) => (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
global.getCompletedWorkouts = () => [{}, {}, {}];

global.MuscleHeatmap = {
  FRONT_REGIONS: [{ muscle: 'chest', d: 'M1 1 L2 1 L2 2 Z' }],
  BACK_REGIONS: [{ muscle: 'back', d: 'M1 1 L2 1 L2 2 Z' }],
  BODY_IMAGES: { front: 'body-map-front.png', back: 'body-map-back.png' },
  BODY_MASKS: { front: 'body-mask-front.png', back: 'body-mask-back.png' },
};

const styleStore = {};
const overlays = {};

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    style: {},
    children: [],
    parentNode: null,
    innerHTML: '',
    textContent: '',
    className: '',
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      return child;
    },
    querySelectorAll(sel) {
      if (sel === '[data-wcm-close]') return [];
      return [];
    },
    querySelector() { return null; },
    addEventListener() {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
  };
  return el;
}

global.document = {
  readyState: 'loading', // avoid auto-init side effects during eval
  body: makeEl('body'),
  head: {
    appendChild(el) { styleStore[el.id] = el; return el; },
  },
  getElementById(id) {
    if (id === 'workout-complete-map-styles') return styleStore[id] || null;
    if (id === 'wcmOverlay') return overlays.wcm || null;
    return null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    const origIdDesc = Object.getOwnPropertyDescriptor(el, 'id');
    Object.defineProperty(el, 'id', {
      get() { return this._id || ''; },
      set(v) {
        this._id = v;
        if (v === 'wcmOverlay') overlays.wcm = el;
      },
    });
    return el;
  },
  addEventListener() {},
  removeEventListener() {},
};

global.window = {
  innerWidth: 390,
  innerHeight: 844,
  matchMedia() {
    return {
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  },
  setTimeout: global.setTimeout,
};

const WorkoutCompleteMap = new Function(
  fs.readFileSync(path.join(__dirname, 'workoutCompleteMap.js'), 'utf8') + '; return WorkoutCompleteMap;'
)();

assert(typeof WorkoutCompleteMap.analyzeWorkout === 'function', 'analyzeWorkout exists');
assert(WorkoutCompleteMap.CORAL === '#ff3b5c', 'coral');
assert(WorkoutCompleteMap.MINT === '#3ee6b0', 'mint');

const sample = {
  duration: 55,
  exercises: [
    {
      name: '벤치 프레스',
      setDetails: [
        { weight: 70, reps: 8, completed: true },
        { weight: 70, reps: 8, completed: true },
        { weight: 70, reps: 6, completed: true },
      ],
    },
  ],
};

const stats = WorkoutCompleteMap.analyzeWorkout(sample);
assert(stats.sets === 3, 'counts completed sets');
assert(stats.volume === 70 * 8 + 70 * 8 + 70 * 6, 'volume sum');
assert(stats.loads.chest > 0, 'chest load');
assert(stats.tags[0].muscle === 'chest', 'primary tag is chest');
assert(stats.tags[0].label === '가슴', 'Korean muscle label');

WorkoutCompleteMap.init();
const shown = WorkoutCompleteMap.show(sample);
assert(shown === true, 'show returns true');
assert(overlays.wcm, 'overlay created');
assert(overlays.wcm.innerHTML.includes('운동 완료'), 'Korean complete title');
assert(overlays.wcm.innerHTML.includes('볼륨'), 'volume label');
assert(overlays.wcm.innerHTML.includes('세트'), 'sets label');
assert(overlays.wcm.innerHTML.includes('가슴'), 'muscle tag');
assert(overlays.wcm.innerHTML.includes('wcm-svg'), 'heatmap svg');

const src = fs.readFileSync(path.join(__dirname, 'workoutCompleteMap.js'), 'utf8');
assert(src.includes('prefers-reduced-motion'), 'reduced motion');
assert(src.includes('자극 부위'), 'Korean section label');

console.log(failures === 0 ? 'WorkoutCompleteMap tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
