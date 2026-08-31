#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

global.MUSCLE_ORDER = ['chest', 'back', 'shoulder', 'biceps', 'quads', 'calves'];
global.MUSCLE_LABELS = {
  chest: { name: '가슴', icon: '🫁' },
  back: { name: '등', icon: '🔵' },
  shoulder: { name: '어깨', icon: '🟡' },
  biceps: { name: '이두', icon: '💪' },
  quads: { name: '대퇴사두', icon: '🦵' },
  calves: { name: '종아리', icon: '🦶' },
};

global.MuscleHeatmap = {
  BODY_IMAGES: { front: 'body-map-front.png', back: 'body-map-back.png' },
  BODY_MASKS: { front: 'body-mask-front.png', back: 'body-mask-back.png' },
  FRONT_REGIONS: [
    { muscle: 'chest', d: 'M10 10L20 10L20 20L10 20Z' },
    { muscle: 'quads', d: 'M30 30L40 30L40 40L30 40Z' },
    { muscle: 'biceps', d: 'M50 50L60 50L60 60L50 60Z' },
  ],
  BACK_REGIONS: [
    { muscle: 'back', d: 'M10 10L20 10L20 20L10 20Z' },
    { muscle: 'calves', d: 'M30 30L40 30L40 40L30 40Z' },
  ],
  SHORT_NAMES: { chest: '가슴', quads: '대퇴', back: '등', calves: '종아리', biceps: '이두' },
  LABEL_POSITIONS: {
    front: { chest: { x: 120, y: 96 }, quads: { x: 92, y: 210 }, biceps: { x: 70, y: 112 } },
    back: { back: { x: 120, y: 118 }, calves: { x: 92, y: 290 } },
  },
  getShortName(k) { return this.SHORT_NAMES[k] || k; },
};

let fakeComputeResult = null;
global.MuscleGrowthTracker = {
  MAX_GROWTH_PCT: 3,
  MAX_LOSS_PCT: 8,
  compute() { return fakeComputeResult; },
};

global.loadWorkouts = () => [];

const MuscleGrowthDetail = new Function(
  fs.readFileSync(path.join(__dirname, 'muscleGrowthDetail.js'), 'utf8') + '; return MuscleGrowthDetail;'
)();

console.log('=== 1. 부위 상태 판정 (getMuscleVisual) ===');
{
  const perMuscle = {
    chest: { growth: { growthPct: 2.4, sessionCount: 6 }, loss: { lossPct: 0, daysSince: 3 } },
    quads: { growth: null, loss: { lossPct: 5.2, daysSince: 30 } },
    biceps: { growth: { growthPct: 0, sessionCount: 2 }, loss: { lossPct: 0, daysSince: 5 } },
    back: { growth: null, loss: null },
  };
  const chest = MuscleGrowthDetail.getMuscleVisual(perMuscle, 'chest');
  assert(chest.status === 'growth' && chest.pct === 2.4, `가슴은 성장 상태 (실제 ${JSON.stringify(chest)})`);

  const quads = MuscleGrowthDetail.getMuscleVisual(perMuscle, 'quads');
  assert(quads.status === 'loss' && quads.pct === 5.2, `대퇴사두는 손실 상태 (실제 ${JSON.stringify(quads)})`);

  const biceps = MuscleGrowthDetail.getMuscleVisual(perMuscle, 'biceps');
  assert(biceps.status === 'neutral', `이두는 정체 상태 (실제 ${JSON.stringify(biceps)})`);

  const back = MuscleGrowthDetail.getMuscleVisual(perMuscle, 'back');
  assert(back.status === 'idle', `등은 기록 없음 상태 (실제 ${JSON.stringify(back)})`);

  // 두 지표가 모두 양수일 때, 상한값 기준으로 정규화한 비율로 더 우세한 쪽을 선택
  // growthRatio = 0.3/3 = 0.1, lossRatio = 1.0/8 = 0.125 → 손실이 더 우세
  const mixed = { calves: { growth: { growthPct: 0.3, sessionCount: 1 }, loss: { lossPct: 1.0, daysSince: 16 } } };
  const calves = MuscleGrowthDetail.getMuscleVisual(mixed, 'calves');
  assert(calves.status === 'loss', `성장/손실 동시 존재 시 정규화 비율로 우세 지표 선택 (실제 ${JSON.stringify(calves)})`);
}

console.log('=== 2. 부위별 성장/손실 목록 ===');
{
  const perMuscle = {
    chest: { growth: { growthPct: 2.4, sessionCount: 6 }, loss: { lossPct: 0, daysSince: 3 } },
    back: { growth: { growthPct: 1.0, sessionCount: 4 }, loss: { lossPct: 0, daysSince: 5 } },
    shoulder: { growth: null, loss: { lossPct: 6.4, daysSince: 40 } },
    biceps: { growth: null, loss: { lossPct: 2.1, daysSince: 20 } },
    quads: { growth: { growthPct: 0, sessionCount: 1 }, loss: { lossPct: 0, daysSince: 8 } },
    calves: { growth: null, loss: null },
  };

  const growthList = MuscleGrowthDetail.getGrowthList(perMuscle);
  assert(growthList.length === 2, `성장 리스트는 성장 지수 > 0 부위만 (실제 ${growthList.length}개)`);
  assert(growthList[0].muscle === 'chest', `내림차순 정렬 1위는 가슴 (실제 ${growthList[0].muscle})`);
  assert(growthList[0].pct >= growthList[1].pct, '성장 리스트는 퍼센트 내림차순');

  const lossList = MuscleGrowthDetail.getLossList(perMuscle);
  assert(lossList.length === 2, `손실 리스트는 손실 지수 > 0 부위만 (실제 ${lossList.length}개)`);
  assert(lossList[0].muscle === 'shoulder', `내림차순 정렬 1위는 어깨 (실제 ${lossList[0].muscle})`);
  assert(lossList[0].pct >= lossList[1].pct, '손실 리스트는 퍼센트 내림차순');
}

console.log('=== 3. 히트맵 SVG 렌더 ===');
{
  const perMuscle = {
    chest: { growth: { growthPct: 2.4, sessionCount: 6 }, loss: { lossPct: 0, daysSince: 3 } },
    quads: { growth: null, loss: { lossPct: 6.5, daysSince: 40 } },
  };
  const svg = MuscleGrowthDetail.buildSvg('front', perMuscle);
  assert(svg.includes('mh-svg'), 'svg 루트 클래스 존재');
  assert(svg.includes('body-map-front.png'), 'MuscleHeatmap의 전면 이미지 재사용');
  assert(svg.includes('data-muscle="chest"'), '가슴 region 존재');
  assert(svg.includes('var(--green)'), '성장 부위는 초록색');
  assert(svg.includes('var(--red)'), '고강도 손실 부위는 빨간색 (6.5/8=81% > 50% 임계값)');
  assert(svg.includes('mgdMask-front'), '고유 마스크 id 사용 (다른 히트맵과 충돌 방지)');

  const backSvg = MuscleGrowthDetail.buildSvg('back', {});
  assert(backSvg.includes('body-map-back.png'), 'MuscleHeatmap의 후면 이미지 재사용');
  assert(backSvg.includes('mgdMask-back'), '후면도 고유 마스크 id 사용');
}

console.log('=== 4. 목록 시트 HTML ===');
{
  const growthList = MuscleGrowthDetail.getGrowthList({
    chest: { growth: { growthPct: 2.4, sessionCount: 6 }, loss: null },
  });
  const html = MuscleGrowthDetail.buildListSheetHtml('growth', growthList, {
    icon: '📈', kicker: '근성장', title: '성장 중인 부위', color: 'var(--green)',
    emptyText: '없음', formatPct: (p) => `+${p}%`, formatSub: (i) => `세션 ${i.sessionCount}회`,
  });
  assert(html.includes('mgd-sheet'), '시트 루트 클래스 존재');
  assert(html.includes('가슴'), '가슴 항목 렌더');
  assert(html.includes('+2.4%'), '성장 퍼센트 표시');
  assert(html.includes('closeList'), '닫기 버튼 연결');

  const emptyHtml = MuscleGrowthDetail.buildListSheetHtml('loss', [], {
    icon: '📉', kicker: '근손실', title: '손실 중인 부위', color: 'var(--red)',
    emptyText: '손실 부위가 없어요', formatPct: (p) => `-${p}%`, formatSub: () => '',
  });
  assert(emptyHtml.includes('mgd-list-empty'), '빈 목록 안내 렌더');
  assert(emptyHtml.includes('손실 부위가 없어요'), '빈 목록 문구 렌더');
}

console.log('=== 5. 홈 카드 연결 (오버레이 오픈/닫기, 지수 탭 위임) ===');
{
  fakeComputeResult = {
    hasData: true,
    perMuscle: {
      chest: { growth: { growthPct: 2.4, sessionCount: 6 }, loss: null },
      quads: { growth: null, loss: { lossPct: 5.0, daysSince: 30 } },
    },
  };

  function makeOverlay() {
    return {
      classList: {
        _show: false,
        add(c) { if (c === 'show') this._show = true; },
        remove(c) { if (c === 'show') this._show = false; },
        contains(c) { return c === 'show' ? this._show : false; },
      },
      innerHTML: '',
    };
  }

  const mgdOverlay = makeOverlay();
  const summaryContainer = {
    _listeners: [],
    addEventListener(type, fn) { this._listeners.push([type, fn]); },
    dispatch(type, target) {
      this._listeners.filter((l) => l[0] === type).forEach((l) => l[1]({ target }));
    },
  };
  const heatmapContainer = {
    innerHTML: '',
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };

  global.document = {
    getElementById(id) {
      if (id === 'mgdOverlay') return mgdOverlay;
      if (id === 'muscleGrowthCard') return summaryContainer;
      if (id === 'muscleGrowthHeatmapCard') return heatmapContainer;
      return null;
    },
  };

  MuscleGrowthDetail.afterHomeRender();
  assert(heatmapContainer.innerHTML.includes('mh-card'), '히트맵 카드가 렌더됨 (데이터 있음)');
  assert(summaryContainer._listeners.length === 1, '요약 카드에 클릭 리스너 1회 연결');

  // 재렌더 시에도 리스너가 중복 연결되지 않아야 함 (EventBus 중복 구독 방지와 동일한 취지)
  MuscleGrowthDetail.afterHomeRender();
  assert(summaryContainer._listeners.length === 1, '재렌더해도 리스너 중복 연결 안 됨');

  const growthTarget = { closest(sel) { return sel === '[data-mgt-type]' ? { dataset: { mgtType: 'growth' } } : null; } };
  summaryContainer.dispatch('click', growthTarget);
  assert(mgdOverlay.classList.contains('show'), '근성장 탭 시 목록 오버레이 열림');
  assert(mgdOverlay.innerHTML.includes('성장 중인 부위'), '성장 리스트 제목 렌더');
  assert(mgdOverlay.innerHTML.includes('가슴'), '성장 부위(가슴) 렌더');

  MuscleGrowthDetail.closeList();
  assert(!mgdOverlay.classList.contains('show'), '닫기 후 오버레이 숨김');
  assert(mgdOverlay.innerHTML === '', '닫기 후 내용 비움');

  const lossTarget = { closest(sel) { return sel === '[data-mgt-type]' ? { dataset: { mgtType: 'loss' } } : null; } };
  summaryContainer.dispatch('click', lossTarget);
  assert(mgdOverlay.innerHTML.includes('손실 중인 부위'), '손실 리스트 제목 렌더');
  assert(mgdOverlay.innerHTML.includes('대퇴사두'), '손실 부위(대퇴사두) 렌더');

  fakeComputeResult = { hasData: false, perMuscle: {} };
  MuscleGrowthDetail.renderHeatmapCard();
  assert(heatmapContainer.innerHTML === '', '데이터 없으면 히트맵 카드 비움 (지수 카드와 동일한 동작)');
}

console.log('=== 6. 다른 모듈과의 연결 지점 확인 ===');
{
  const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  assert(appJs.includes('MuscleGrowthDetail.afterHomeRender()'), 'app.js renderHome()에서 부위별 상세 렌더 훅 호출');

  const growthDetailJs = fs.readFileSync(path.join(__dirname, 'muscleGrowthDetail.js'), 'utf8');
  assert(growthDetailJs.includes('ExerciseStimHeatmap.openMuscle'), '부위 탭 시 ExerciseStimHeatmap의 추천 운동 시트를 재사용 (읽기 전용 공개 API만 호출)');

  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(indexHtml.includes('id="muscleGrowthHeatmapCard"'), 'index.html에 히트맵 카드 컨테이너 존재');
  assert(indexHtml.includes('id="mgdOverlay"'), 'index.html에 목록 시트 오버레이 존재');
  assert(indexHtml.includes('<script src="muscleGrowthDetail.js"></script>'), 'index.html에 스크립트 태그 등록');

  const trackerJs = fs.readFileSync(path.join(__dirname, 'muscleGrowthTracker.js'), 'utf8');
  assert(trackerJs.includes('data-mgt-type="growth"'), '근성장 지수 탭 타겟 속성 존재 (muscleGrowthTracker.js)');
  assert(trackerJs.includes('data-mgt-type="loss"'), '근손실 지수 탭 타겟 속성 존재 (muscleGrowthTracker.js)');
  assert(trackerJs.includes('MAX_GROWTH_PCT') && trackerJs.includes('MAX_LOSS_PCT,'), '상한 상수를 읽기 전용으로 노출');

  const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  assert(swJs.includes("'./muscleGrowthDetail.js'"), 'sw.js ASSETS에 등록');
  assert(swJs.includes("'/muscleGrowthDetail.js'"), 'sw.js NETWORK_FIRST_PATHS에 등록');
}

console.log('=== 7. 부위 탭 → 추천 운동 연동 (ExerciseStimHeatmap 재사용) ===');
{
  fakeComputeResult = {
    hasData: true,
    perMuscle: {
      chest: { growth: { growthPct: 2.4, sessionCount: 6 }, loss: null },
    },
  };

  const openMuscleCalls = [];
  global.ExerciseStimHeatmap = {
    openMuscle(muscleKey) { openMuscleCalls.push(muscleKey); },
  };

  function makeOverlay() {
    return {
      classList: {
        _show: false,
        add(c) { if (c === 'show') this._show = true; },
        remove(c) { if (c === 'show') this._show = false; },
        contains(c) { return c === 'show' ? this._show : false; },
      },
      innerHTML: '',
    };
  }
  const mgdOverlay = makeOverlay();

  const tooltip = { innerHTML: '', classList: { add() {}, remove() {} } };

  function makeSvg() {
    return {
      _listeners: [],
      addEventListener(type, fn) { this._listeners.push([type, fn]); },
      dispatch(type, target) {
        this._listeners.filter((l) => l[0] === type).forEach((l) => l[1]({ target }));
      },
    };
  }
  const svgEl = makeSvg();
  const heatmapContainer = {
    innerHTML: '',
    querySelectorAll() { return []; },
    querySelector(sel) { return sel === '.mh-svg' ? svgEl : null; },
  };

  global.document = {
    getElementById(id) {
      if (id === 'mgdOverlay') return mgdOverlay;
      if (id === 'mgdTooltip') return tooltip;
      if (id === 'muscleGrowthHeatmapCard') return heatmapContainer;
      return null;
    },
  };

  MuscleGrowthDetail.renderHeatmapCard();
  assert(svgEl._listeners.some((l) => l[0] === 'click'), 'SVG에 클릭 리스너 연결됨');

  const regionTarget = {
    closest(sel) {
      return sel === '.mh-region'
        ? { dataset: { muscle: 'chest', label: '가슴', status: 'growth', pct: '2.4' } }
        : null;
    },
  };
  svgEl.dispatch('click', regionTarget);
  assert(tooltip.innerHTML.includes('가슴'), '부위 탭 시 기존 상태 툴팁도 그대로 표시 (기존 동작 유지)');
  assert(
    openMuscleCalls.length === 1 && openMuscleCalls[0] === 'chest',
    '부위 탭 시 ExerciseStimHeatmap.openMuscle 호출 (회복 히트맵과 동일한 추천 운동 연동)'
  );

  // 근성장/근손실 지수 → 부위별 목록 시트에서도 부위를 탭하면 추천 운동이 열려야 함
  const growthList = MuscleGrowthDetail.getGrowthList({
    chest: { growth: { growthPct: 2.4, sessionCount: 6 }, loss: null },
  });
  const listHtml = MuscleGrowthDetail.buildListSheetHtml('growth', growthList, {
    icon: '📈', kicker: '근성장', title: '성장 중인 부위', color: 'var(--green)',
    emptyText: '없음', formatPct: (p) => `+${p}%`, formatSub: (i) => `세션 ${i.sessionCount}회`,
  });
  assert(listHtml.includes("MuscleGrowthDetail.openMuscleExercises('chest')"), '목록 항목 탭 시 추천 운동 함수로 연결됨');
  assert(listHtml.includes('mgd-list-arrow'), '목록 항목에 탭 가능함을 알리는 화살표 표시');

  MuscleGrowthDetail.openMuscleExercises('chest');
  assert(openMuscleCalls.length === 2 && openMuscleCalls[1] === 'chest', 'openMuscleExercises가 ExerciseStimHeatmap.openMuscle을 호출');
  assert(!mgdOverlay.classList.contains('show'), '추천 운동 오픈 시 목록 시트는 자동으로 닫힘 (esh-overlay와 z-index 충돌 방지)');
}

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
