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
assert(src.includes('MuscleHeatmap.FRONT_REGIONS') || src.includes('getFrontRegions'), 'reuses FRONT_REGIONS');
assert(src.includes('DETAIL_BACK_REGIONS'), 'detail back region splits');
assert(src.includes('packLabelLayouts'), 'label collision packer');
assert(src.includes('ensureSelectionForView'), 'side-aware selection');
assert(src.includes("labelId: 'glutes'"), 'glute paths labeled');
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
assert(swJs.includes('recovr-cache-v94'), 'SW cache bump v94');
assert(src.includes('hbmdMask-'), 'uses SVG mask ids');
assert(!/mask-image\s*:/.test(src), 'no CSS mask-image on fill layer');
assert(src.includes('preserveAspectRatio="xMidYMid meet"'), 'image+mask preserveAspectRatio meet');
assert(src.includes('maskUnits="userSpaceOnUse"'), 'maskUnits userSpaceOnUse in source');
assert(src.includes('maskContentUnits="userSpaceOnUse"'), 'maskContentUnits userSpaceOnUse in source');
assert(src.includes('FILL_CALIBRATE'), 'fill calibrate matrix present');
assert(src.includes('Do NOT reuse class "mh-svg"') || src.includes('class="hbmd-svg"'), 'detail SVG avoids mh-svg max-height trap');
assert(!/class="mh-svg hbmd-svg"/.test(src), 'detail root class is not mh-svg');
assert(src.includes('filter: none !important') || src.includes('filter:none'), 'detail fills disable glow filters');
assert(src.includes('aspect-ratio: 240 / 360') || src.includes('aspect-ratio:240/360'), 'SVG locks 240:360 aspect');

console.log('=== 3. Runtime helpers ===');
global.MUSCLE_ORDER = [
  'chest', 'back', 'shoulder', 'biceps', 'triceps',
  'quads', 'hamstrings', 'adductors', 'calves', 'core', 'forearms',
];
global.MUSCLE_LABELS = {
  chest: { name: '가슴', icon: '💪' },
  back: { name: '등', icon: '🏋️' },
  shoulder: { name: '어깨', icon: '🟡' },
  biceps: { name: '이두', icon: '💪' },
  triceps: { name: '삼두', icon: '🔱' },
  quads: { name: '대퇴사두', icon: '🦵' },
  hamstrings: { name: '둔근/햄스트링', icon: '🍑' },
  adductors: { name: '내전/외전근', icon: '⬡' },
  calves: { name: '종아리', icon: '🦶' },
  core: { name: '코어', icon: '🔶' },
  forearms: { name: '전완', icon: '✊' },
};
global.MuscleHeatmap = {
  FRONT_REGIONS: [
    { muscle: 'chest', d: 'M0 0L1 0L1 1Z' },
    { muscle: 'shoulder', d: 'M0 0L1 0L1 1Z' },
    { muscle: 'biceps', d: 'M0 0L1 0L1 1Z' },
    { muscle: 'core', d: 'M0 0L1 0L1 1Z' },
    { muscle: 'forearms', d: 'M0 0L1 0L1 1Z' },
    { muscle: 'quads', d: 'M0 0L1 0L1 1Z' },
    { muscle: 'adductors', d: 'M0 0L1 0L1 1Z' },
    { muscle: 'calves', d: 'M0 0L1 0L1 1Z' },
  ],
  BACK_REGIONS: [
    // Mega blob — detail view must replace this with ≥3 back splits
    { muscle: 'back', d: 'M112 52L90 188L150 188Z' },
    { muscle: 'shoulder', d: 'M70 70L90 70L90 100Z' },
    { muscle: 'triceps', d: 'M60 90L80 90L80 120Z' },
    { muscle: 'hamstrings', d: 'M90 180L110 180L110 240Z' },
    { muscle: 'adductors', d: 'M110 185L120 185L120 230Z' },
    { muscle: 'calves', d: 'M90 240L110 240L110 320Z' },
    { muscle: 'forearms', d: 'M40 130L60 130L60 180Z' },
  ],
  LABEL_POSITIONS: { front: {}, back: {} },
  SHORT_NAMES: {
    chest: '가슴', back: '등', shoulder: '어깨', biceps: '이두', triceps: '삼두',
    quads: '대퇴', hamstrings: '햄스', adductors: '내전', calves: '종아리',
    core: '코어', forearms: '전완',
  },
  getShortName: (k) => global.MuscleHeatmap.SHORT_NAMES[k] || k,
  getRecoveryColor: (pct) => (pct < 40 ? '#ff3b5c' : pct < 95 ? '#f5a524' : '#3ee6b0'),
  getHoursUntilReady: () => 4,
  ASSET_VERSION: 'v56',
  IDLE_FILL: '#2c2c36',
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
  chest: { volume: 12000, lastDate: '2026-11-20', recoveryPct: 21, hoursElapsed: 10, recoveryHours: 48 },
  back: { volume: 8000, lastDate: '2026-11-24', recoveryPct: 13, hoursElapsed: 4, recoveryHours: 48 },
  shoulder: { volume: 4000, lastDate: '2026-11-10', recoveryPct: 100, hoursElapsed: 100, recoveryHours: 48 },
  triceps: { volume: 2000, lastDate: '2026-11-12', recoveryPct: 100, hoursElapsed: 90, recoveryHours: 48 },
  hamstrings: { volume: 5000, lastDate: '2026-11-08', recoveryPct: 100, hoursElapsed: 120, recoveryHours: 48 },
  adductors: { volume: 1500, lastDate: '2026-11-08', recoveryPct: 100, hoursElapsed: 120, recoveryHours: 48 },
  calves: { volume: 1000, lastDate: '2026-11-05', recoveryPct: 100, hoursElapsed: 140, recoveryHours: 48 },
  quads: { volume: 0, lastDate: null, recoveryPct: 100, hoursElapsed: null, recoveryHours: 48 },
  biceps: { volume: 3000, lastDate: '2026-11-18', recoveryPct: 100, hoursElapsed: 80, recoveryHours: 48 },
  core: { volume: 0, lastDate: null, recoveryPct: 100, hoursElapsed: null, recoveryHours: 48 },
  forearms: { volume: 0, lastDate: null, recoveryPct: 100, hoursElapsed: null, recoveryHours: 48 },
};
const growth = {
  hasData: true,
  perMuscle: {
    chest: { growth: { growthPct: 2.4, sessionCount: 6, recentAvgVolume: 11000 }, loss: { lossPct: 0, daysSince: 3 } },
    back: { growth: { growthPct: 0.8, sessionCount: 3, recentAvgVolume: 7000 }, loss: { lossPct: 0, daysSince: 2 } },
    shoulder: { growth: { growthPct: 1.5, sessionCount: 4, recentAvgVolume: 4000 }, loss: { lossPct: 0, daysSince: 5 } },
    triceps: { growth: { growthPct: 0, sessionCount: 1, recentAvgVolume: 1000 }, loss: { lossPct: 0, daysSince: 4 } },
    hamstrings: { growth: { growthPct: 0.5, sessionCount: 2, recentAvgVolume: 3000 }, loss: { lossPct: 0, daysSince: 6 } },
    adductors: { growth: null, loss: { lossPct: 0, daysSince: 6 } },
    calves: { growth: null, loss: { lossPct: 2.0, daysSince: 20 } },
    quads: { growth: null, loss: { lossPct: 5.2, daysSince: 30 } },
    biceps: { growth: { growthPct: 0, sessionCount: 1, recentAvgVolume: 2000 }, loss: { lossPct: 1.0, daysSince: 16 } },
    core: { growth: null, loss: { lossPct: 0, daysSince: 40 } },
    forearms: { growth: null, loss: { lossPct: 0, daysSince: 40 } },
  },
};

const recoveryList = HomeBodyMapDetail.getSortedListForTest('recovery', recovery, growth);
assert(recoveryList[0].muscle === 'back', 'recovery sorts most fatigued first (back 13%)');
assert(recoveryList.find((r) => r.muscle === 'chest').pct === 21, 'recovery pct exact');

const growthList = HomeBodyMapDetail.getSortedListForTest('growth', recovery, growth);
assert(growthList[0].muscle === 'chest', 'growth sorts highest first');
assert(growthList[0].pct === 2.4, 'growth pct exact');

const lossList = HomeBodyMapDetail.getSortedListForTest('loss', recovery, growth);
assert(lossList[0].muscle === 'quads', 'loss sorts highest first');
assert(lossList[0].pct === 5.2, 'loss pct exact');

const tip = HomeBodyMapDetail.buildTipForTest('recovery', {
  muscle: 'chest', hasSignal: true, pct: 21,
});
assert(tip.includes('피곤'), 'plain Korean recovery tip');

const tipG = HomeBodyMapDetail.buildTipForTest('growth', {
  muscle: 'chest', hasSignal: true, pct: 2.4,
});
assert(tipG.includes('자극') || tipG.includes('페이스'), 'plain Korean growth tip');

console.log('=== 3b. Growth / loss colors match legend + 3D ===');
assert(HomeBodyMapDetail.STRONG_GROWTH_PCT === 1.5, 'strong growth threshold 1.5');
assert(HomeBodyMapDetail.GROWTH_TEAL === '#1aa88a', 'growing teal');
assert(HomeBodyMapDetail.GROWTH_LIME === '#b8ff3d', 'strong growth lime');
assert(HomeBodyMapDetail.STRONG_LOSS_PCT === 4, 'strong loss threshold 4');
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
assert(
  HomeBodyMapDetail.getFillForTest('growth', noGrowthRow).opacity === 0,
  'growth no-signal is unpainted (opacity 0)'
);
const mildLoss = { muscle: 'calves', hasSignal: true, pct: 2.0 };
const deepLoss = { muscle: 'quads', hasSignal: true, pct: 5.2 };
const noLoss = { muscle: 'core', hasSignal: false, pct: 0 };
assert(HomeBodyMapDetail.getFillForTest('loss', mildLoss).fill === HomeBodyMapDetail.LOSS_VIOLET, 'loss violet');
assert(HomeBodyMapDetail.getFillForTest('loss', deepLoss).fill === HomeBodyMapDetail.LOSS_INDIGO, 'loss deep indigo ≥4%');
assert(HomeBodyMapDetail.getFillForTest('loss', noLoss).opacity === 0, 'loss no-signal unpainted');
assert(
  HomeBodyMapDetail.formatValueColorForTest('loss', deepLoss) === HomeBodyMapDetail.LOSS_INDIGO,
  'loss card/list color matches map indigo'
);
assert(
  HomeBodyMapDetail.formatValueColorForTest('loss', mildLoss) === HomeBodyMapDetail.LOSS_VIOLET,
  'loss card/list color matches map violet'
);

console.log('=== 3c. Back region splits + glutes + mapping audit ===');
assert(HomeBodyMapDetail.countBackSplitsForTest() >= 3, 'back split into ≥3 shapes (no mega blob)');
const backMuscles = HomeBodyMapDetail.getBackRegionMusclesForTest();
assert(backMuscles.includes('hamstrings'), 'glute paths map to hamstrings app key');
assert(HomeBodyMapDetail.resolveDataKey('glutes') === 'hamstrings', 'glutes label aliases to hamstrings');
assert(HomeBodyMapDetail.LABEL_DATA_KEY.glutes === 'hamstrings', 'LABEL_DATA_KEY glutes→hamstrings');
const mappingIssues = HomeBodyMapDetail.auditRegionMapping();
assert(mappingIssues.length === 0, `region mapping clean (${mappingIssues.join('; ') || 'ok'})`);
assert(
  HomeBodyMapDetail.DETAIL_LABEL_POSITIONS.back.glutes,
  'back view has 둔근 (glutes) label position'
);
assert(
  !HomeBodyMapDetail.VIEW_MUSCLES.back.includes('chest'),
  'chest is not a back-view muscle'
);
assert(
  HomeBodyMapDetail.VIEW_MUSCLES.front.includes('chest'),
  'chest is a front-view muscle'
);

console.log('=== 3d. Side-aware default selection ===');
const frontDefault = HomeBodyMapDetail.pickDefaultMuscleForTest('front', 'recovery', recovery, growth);
assert(frontDefault === 'chest', 'front default = most fatigued front muscle (chest)');
const backDefault = HomeBodyMapDetail.pickDefaultMuscleForTest('back', 'recovery', recovery, growth);
assert(backDefault === 'back', 'back default = most fatigued back muscle (back)');
const switched = HomeBodyMapDetail.ensureSelectionForTest(
  'back', 'recovery', recovery, growth, 'chest'
);
assert(switched === 'back', 'switching to back replaces front-only chest selection');
const keepShoulder = HomeBodyMapDetail.ensureSelectionForTest(
  'back', 'recovery', recovery, growth, 'shoulder'
);
assert(keepShoulder === 'shoulder', 'shared shoulder stays selected across sides');

console.log('=== 3e. Label collision avoidance at 390px stack height ===');
const packed = HomeBodyMapDetail.packLabelsForTest('back', 'recovery', recovery, growth);
assert(packed.some((p) => p.labelId === 'glutes'), 'packed labels include 둔근');
assert(packed.some((p) => p.labelId === 'back'), 'packed labels include 등');
assert(packed.some((p) => p.labelId === 'triceps'), 'packed labels include 삼두');
const left = packed.filter((p) => p.side === 'left').sort((a, b) => a.y - b.y);
const right = packed.filter((p) => p.side === 'right').sort((a, b) => a.y - b.y);
function noOverlapGap(col, minGap) {
  for (let i = 1; i < col.length; i += 1) {
    if (col[i].y - col[i - 1].y < minGap) return false;
  }
  return true;
}
assert(noOverlapGap(left, 28), `left labels spaced (≥28px): ${left.map((p) => `${p.labelId}@${p.y}`).join(', ')}`);
assert(noOverlapGap(right, 28), `right labels spaced (≥28px): ${right.map((p) => `${p.labelId}@${p.y}`).join(', ')}`);

console.log('=== 3f. SVG paint sanity (recovery back) ===');
const svgBack = HomeBodyMapDetail.buildSvgForTest('back', 'recovery', recovery, growth);
assert((svgBack.match(/data-muscle="back"/g) || []).length >= 3, 'SVG has ≥3 back paths');
assert(svgBack.includes('data-muscle="hamstrings"'), 'SVG paints glute/hamstrings paths');
assert(svgBack.includes('data-label-id="glutes"'), 'SVG has 둔근 label');
assert(svgBack.includes('id="hbmdMask-back"'), 'SVG <mask> for back fills');
assert(svgBack.includes('maskUnits="userSpaceOnUse"'), 'maskUnits userSpaceOnUse (not objectBoundingBox)');
assert(svgBack.includes('maskContentUnits="userSpaceOnUse"'), 'maskContentUnits userSpaceOnUse');
assert(svgBack.includes('mask="url(#hbmdMask-back)"'), 'muscles group uses SVG mask url');
assert(!svgBack.includes('mask-image'), 'no CSS mask-image in rendered SVG');
assert(!/maskUnits="objectBoundingBox"/.test(svgBack), 'no objectBoundingBox maskUnits');
assert(svgBack.includes('stroke-width') || svgBack.includes('stroke='), 'region borders present');
const svgFront = HomeBodyMapDetail.buildSvgForTest('front', 'recovery', recovery, growth);
assert(svgFront.includes('id="hbmdMask-front"'), 'SVG <mask> for front fills');
assert(svgFront.includes('preserveAspectRatio="xMidYMid meet"'), 'front image+mask meet');
assert(/class="hbmd-svg"/.test(svgFront), 'rendered root class is hbmd-svg only');
assert(!/\bmh-svg\b/.test(svgFront), 'rendered SVG does not use mh-svg');
assert(/hbmd-muscles[^>]*transform=/.test(svgFront) || svgFront.includes('FILL_CALIBRATE')
  || /translate\(120/.test(svgFront), 'muscles group has calibrate transform');
assert(HomeBodyMapDetail.FILL_CALIBRATE
  && HomeBodyMapDetail.FILL_CALIBRATE.scale >= 1
  && HomeBodyMapDetail.FILL_CALIBRATE.scale <= 1.1, 'calibrate scale is modest (≤1.1)');
const svgGrowth = HomeBodyMapDetail.buildSvgForTest('front', 'growth', recovery, growth);
assert(svgGrowth.includes('#b8ff3d') || svgGrowth.includes('#1aa88a'), 'growth SVG uses teal/lime fills');
assert(svgGrowth.includes('data-muscle="chest"'), 'growth paints trained chest');

console.log('=== 4. Korean rotate hint ===');
assert(bm3.includes('밀어 돌리기'), 'rotate hint Korean');
assert(bm3.includes('word-break: keep-all'), 'hint keep-all');
assert(!bm3.includes('Drag to rotate'), 'English drag hint removed');

console.log(failures === 0 ? '\n=== HomeBodyMapDetail tests passed ✓ ===' : `\n=== ${failures} FAILED ✗ ===`);
process.exit(failures === 0 ? 0 : 1);
