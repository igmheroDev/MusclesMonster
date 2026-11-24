#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

const root = __dirname;
const src = fs.readFileSync(path.join(root, 'homeBodyMapDetail.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const swJs = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const bm3 = fs.readFileSync(path.join(root, 'bodyMap3d.js'), 'utf8');

console.log('=== 1. Module surface ===');
assert(src.includes('const HomeBodyMapDetail'), 'HomeBodyMapDetail module');
assert(src.includes('자세히 보기'), 'Korean open button label');
assert(src.includes('history.pushState'), 'history push for Android back');
assert(src.includes('popstate'), 'popstate closes sheet');
assert(src.includes('touchstart') && src.includes('touchmove'), 'swipe-to-close hooks');
assert(src.includes('min-height: 44px') || src.includes('MIN_TAP = 44'), '44px tap targets');
assert(src.includes('touch-action: pan-y'), 'sheet body pan-y (no scroll trap)');
assert(!/setPreferredMode\s*\(/.test(src), 'never calls setPreferredMode');
assert(src.includes('MuscleHeatmap.FRONT_REGIONS') || src.includes('MuscleHeatmap.FRONT_REGIONS'), 'reuses FRONT_REGIONS');
assert(src.includes('calcMuscleRecovery'), 'reuses calcMuscleRecovery');
assert(src.includes('MuscleGrowthTracker.compute'), 'reuses growth/loss compute');
assert(src.includes('Heatmap3dModes.getState'), 'follows Heatmap3dModes mode');
assert(src.includes('부위별 수치 목록'), 'sorted list section');
assert(src.includes('마지막 훈련'), 'last trained copy');
assert(src.includes('최근 볼륨'), 'volume copy');
assert(src.includes('MODE_TITLES'), 'mode titles');

console.log('=== 2. Wiring ===');
assert(indexHtml.includes('homeBodyMapDetail.js'), 'index loads module');
assert(indexHtml.includes('id="hbmdOverlay"'), 'overlay container in DOM');
assert(appJs.includes('HomeBodyMapDetail.afterHomeRender'), 'app hooks afterHomeRender');
assert(swJs.includes('homeBodyMapDetail.js'), 'SW caches module');
assert(swJs.includes('recovr-cache-v93'), 'SW cache bump v93');

console.log('=== 3. Runtime helpers ===');
global.MUSCLE_ORDER = ['chest', 'back', 'quads', 'biceps'];
global.MUSCLE_LABELS = {
  chest: { name: '가슴', icon: '💪' },
  back: { name: '등', icon: '🏋️' },
  quads: { name: '대퇴사두', icon: '🦵' },
  biceps: { name: '이두', icon: '💪' },
};
global.MuscleHeatmap = {
  FRONT_REGIONS: [],
  BACK_REGIONS: [],
  LABEL_POSITIONS: { front: {}, back: {} },
  SHORT_NAMES: { chest: '가슴', back: '등', quads: '대퇴', biceps: '이두' },
  getShortName: (k) => global.MuscleHeatmap.SHORT_NAMES[k] || k,
  getRecoveryColor: (pct) => (pct < 40 ? '#ff3b5c' : pct < 95 ? '#f5a524' : '#3ee6b0'),
  getHoursUntilReady: () => 4,
  ASSET_VERSION: 'v56',
  BODY_IMAGES: { front: 'body-map-front.png', back: 'body-map-back.png' },
  BODY_MASKS: { front: 'body-mask-front.png', back: 'body-mask-back.png' },
};
global.Heatmap3dModes = { getState: () => ({ mode: 'growth' }) };
global.calcMuscleRecovery = () => ({});
global.MuscleGrowthTracker = { compute: () => null, MAX_GROWTH_PCT: 3, MAX_LOSS_PCT: 8 };

const HomeBodyMapDetail = new Function(
  `${src}; return HomeBodyMapDetail;`
)();

const recovery = {
  chest: { volume: 12000, lastDate: '2026-11-20', recoveryPct: 35, hoursElapsed: 10, recoveryHours: 48 },
  back: { volume: 8000, lastDate: '2026-11-22', recoveryPct: 80, hoursElapsed: 20, recoveryHours: 48 },
  quads: { volume: 0, lastDate: null, recoveryPct: 100, hoursElapsed: null, recoveryHours: 48 },
  biceps: { volume: 3000, lastDate: '2026-11-18', recoveryPct: 100, hoursElapsed: 80, recoveryHours: 48 },
};
const growth = {
  hasData: true,
  perMuscle: {
    chest: { growth: { growthPct: 2.4, sessionCount: 6, recentAvgVolume: 11000 }, loss: { lossPct: 0, daysSince: 3 } },
    back: { growth: { growthPct: 0.8, sessionCount: 3, recentAvgVolume: 7000 }, loss: { lossPct: 0, daysSince: 2 } },
    quads: { growth: null, loss: { lossPct: 5.2, daysSince: 30 } },
    biceps: { growth: { growthPct: 0, sessionCount: 1, recentAvgVolume: 2000 }, loss: { lossPct: 1.0, daysSince: 16 } },
  },
};

const recoveryList = HomeBodyMapDetail.getSortedListForTest('recovery', recovery, growth);
assert(recoveryList[0].muscle === 'chest', 'recovery sorts most fatigued first');
assert(recoveryList.find((r) => r.muscle === 'chest').pct === 35, 'recovery pct exact');

const growthList = HomeBodyMapDetail.getSortedListForTest('growth', recovery, growth);
assert(growthList[0].muscle === 'chest', 'growth sorts highest first');
assert(growthList[0].pct === 2.4, 'growth pct exact');

const lossList = HomeBodyMapDetail.getSortedListForTest('loss', recovery, growth);
assert(lossList[0].muscle === 'quads', 'loss sorts highest first');
assert(lossList[0].pct === 5.2, 'loss pct exact');

const tip = HomeBodyMapDetail.buildTipForTest('recovery', {
  muscle: 'chest', hasSignal: true, pct: 35,
});
assert(tip.includes('피곤'), 'plain Korean recovery tip');

const tipG = HomeBodyMapDetail.buildTipForTest('growth', {
  muscle: 'chest', hasSignal: true, pct: 2.4,
});
assert(tipG.includes('자극') || tipG.includes('페이스'), 'plain Korean growth tip');

console.log('=== 3b. Growth value colors match map thresholds ===');
assert(HomeBodyMapDetail.STRONG_GROWTH_PCT === 1.5, 'strong growth threshold 1.5');
assert(HomeBodyMapDetail.GROWTH_TEAL === '#1aa88a', 'growing teal');
assert(HomeBodyMapDetail.GROWTH_LIME === '#b8ff3d', 'strong growth lime');
const growingRow = { muscle: 'back', hasSignal: true, pct: 0.8 };
const strongRow = { muscle: 'chest', hasSignal: true, pct: 1.5 };
const strongerRow = { muscle: 'chest', hasSignal: true, pct: 2.4 };
const noGrowthRow = { muscle: 'biceps', hasSignal: false, pct: 0 };
assert(
  HomeBodyMapDetail.formatValueColorForTest('growth', growingRow) === HomeBodyMapDetail.GROWTH_TEAL,
  'card/list growing uses teal'
);
assert(
  HomeBodyMapDetail.formatValueColorForTest('growth', strongRow) === HomeBodyMapDetail.GROWTH_LIME,
  'card/list ≥1.5% uses lime'
);
assert(
  HomeBodyMapDetail.formatValueColorForTest('growth', strongerRow) === HomeBodyMapDetail.GROWTH_LIME,
  'card/list strong growth uses lime'
);
assert(
  HomeBodyMapDetail.formatValueColorForTest('growth', noGrowthRow) === 'var(--muted)',
  'card/list no signal muted'
);
assert(
  HomeBodyMapDetail.getFillForTest('growth', growingRow).fill
    === HomeBodyMapDetail.formatValueColorForTest('growth', growingRow),
  'map fill matches card/list for growing'
);
assert(
  HomeBodyMapDetail.getFillForTest('growth', strongRow).fill
    === HomeBodyMapDetail.formatValueColorForTest('growth', strongRow),
  'map fill matches card/list at 1.5% threshold'
);
assert(
  HomeBodyMapDetail.getFillForTest('growth', strongerRow).fill
    === HomeBodyMapDetail.formatValueColorForTest('growth', strongerRow),
  'map fill matches card/list for strong growth'
);

console.log('=== 4. Korean rotate hint ===');
assert(bm3.includes('밀어 돌리기'), 'rotate hint Korean');
assert(bm3.includes('word-break: keep-all'), 'hint keep-all');
assert(!bm3.includes('Drag to rotate'), 'English drag hint removed');

console.log(failures === 0 ? '\n=== HomeBodyMapDetail tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
