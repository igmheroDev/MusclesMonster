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
  back: { name: '등' },
  shoulder: { name: '어깨' },
  triceps: { name: '삼두' },
  biceps: { name: '이두' },
  quads: { name: '대퇴사두' },
  hamstrings: { name: '둔근/햄스트링' },
  core: { name: '코어' },
};

global.MuscleHeatmap = {
  ASSET_VERSION: 'v54',
  BODY_IMAGES: { front: 'body-map-front.png', back: 'body-map-back.png' },
  BODY_MASKS: { front: 'body-mask-front.png', back: 'body-mask-back.png' },
  FRONT_REGIONS: [
    { muscle: 'chest', d: 'M10 10 L20 10 L20 20 Z' },
    { muscle: 'shoulder', d: 'M30 10 L40 10 L40 20 Z' },
  ],
  BACK_REGIONS: [
    { muscle: 'back', d: 'M10 10 L20 10 L20 20 Z' },
    { muscle: 'triceps', d: 'M30 10 L40 10 L40 20 Z' },
  ],
  LABEL_POSITIONS: {
    front: { chest: { x: 120, y: 96 } },
    back: { back: { x: 120, y: 118 } },
  },
  getShortName(m) { return m; },
};

global.ExerciseMuscleMap = {
  getStimulation(name) {
    if (String(name).includes('벤치')) return { chest: 3, triceps: 2, shoulder: 2 };
    if (String(name).includes('로우')) return { back: 3, biceps: 2 };
    return {};
  },
};

global.extractExercisesFromForm = () => ([
  {
    name: '벤치 프레스',
    setDetails: [
      { weight: 60, reps: 8, completed: true },
      { weight: 60, reps: 8, completed: true },
      { weight: 60, reps: 8, completed: false },
    ],
  },
]);

const created = [];
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
    dataset: {},
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentNode = null;
      return child;
    },
    insertBefore(node, ref) {
      const idx = this.children.indexOf(ref);
      if (idx >= 0) this.children.splice(idx, 0, node);
      else this.children.push(node);
      node.parentNode = this;
      return node;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    addEventListener() {},
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
      toggle() {},
    },
  };
  created.push(el);
  return el;
}

const bodyChildren = [];
const fakeBody = {
  children: bodyChildren,
  appendChild(child) { bodyChildren.push(child); child.parentNode = this; return child; },
};
const styleStore = {};

global.document = {
  readyState: 'loading', // eval 시 auto-init 방지
  body: fakeBody,
  head: {
    appendChild(el) { styleStore[el.id] = el; return el; },
  },
  getElementById(id) {
    if (id === 'body-map-live-styles') return styleStore[id] || null;
    if (id === 'bodyMapLiveHost') return created.find((c) => c.id === 'bodyMapLiveHost') || null;
    if (id === 'modalOverlay') {
      return {
        classList: { contains: () => true },
      };
    }
    return null;
  },
  createElement(tag) {
    const el = makeEl(tag);
    return el;
  },
  querySelector(sel) {
    if (sel === '#modalOverlay .modal') {
      const modal = makeEl('div');
      modal.querySelector = (s) => {
        if (s === '#exerciseRows') {
          const rows = makeEl('div');
          rows.closest = () => {
            const group = makeEl('div');
            group.parentNode = modal;
            return group;
          };
          return rows;
        }
        return null;
      };
      return modal;
    }
    if (sel === '[data-bml-flipper]') return null;
    return null;
  },
  addEventListener() {},
  removeEventListener() {},
};

global.window = {
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
  requestAnimationFrame(cb) { cb(); },
};

const BodyMapLive = new Function(
  fs.readFileSync(path.join(__dirname, 'bodyMapLive.js'), 'utf8') + '; return BodyMapLive;'
)();

assert(typeof BodyMapLive.init === 'function', 'init exists');
assert(typeof BodyMapLive.computeSessionLoads === 'function', 'computeSessionLoads exists');
assert(BodyMapLive.CORAL === '#ff3b5c', 'coral accent');
assert(BodyMapLive.MINT === '#3ee6b0', 'mint accent');
assert(BodyMapLive.BACK_PRIMARY.has('back'), 'back is primary back-view muscle');
assert(BodyMapLive.BACK_PRIMARY.has('triceps'), 'triceps flips to back');

const loads = BodyMapLive.computeSessionLoads();
assert(loads.chest > 0, 'chest load from completed bench sets');
assert(loads.triceps > 0, 'triceps secondary load');
assert(!(loads.biceps > 0), 'biceps not from bench');

assert(BodyMapLive.intensityOpacity(0) === 0, 'zero load transparent');
assert(BodyMapLive.intensityOpacity(0.5) > 0.16, 'partial load visible');
assert(BodyMapLive.intensityOpacity(10) <= 0.82, 'opacity capped');

const src = fs.readFileSync(path.join(__dirname, 'bodyMapLive.js'), 'utf8');
assert(src.includes('prefers-reduced-motion'), 'respects reduced motion');
assert(src.includes('실시간 자극'), 'Korean UI title');
assert(src.includes('전면') && src.includes('후면'), 'Korean flip labels');

console.log(failures === 0 ? 'BodyMapLive tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
