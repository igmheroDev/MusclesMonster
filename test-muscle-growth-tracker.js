#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

function loadModule(globals) {
  const src = fs.readFileSync(path.join(__dirname, 'muscleGrowthTracker.js'), 'utf8');
  const storage = {};
  const localStorage = {
    getItem: (key) => (key in storage ? storage[key] : null),
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: (key) => { delete storage[key]; },
  };

  const MUSCLE_ORDER = ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'quads'];

  // 테스트용 단순화된 부위 매칭: 이름에 부위 키워드가 포함되면 매칭
  function getMusclesFromExerciseName(name) {
    if (!name) return [];
    const map = {
      chest: ['벤치'],
      back: ['로우', '풀업'],
      shoulder: ['숄더'],
      biceps: ['컬'],
      triceps: ['푸시다운'],
      quads: ['스쿼트'],
    };
    return MUSCLE_ORDER.filter((m) => (map[m] || []).some((kw) => name.includes(kw)));
  }

  function getExerciseVolume(ex) {
    return (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
  }

  function getDurationLoad(ex) {
    return (ex.durationMin || 0) * 60 * 3.0;
  }

  const fakeDocument = {
    readyState: 'complete',
    addEventListener: () => {},
    getElementById: () => null,
  };

  const merged = Object.assign({
    localStorage,
    MUSCLE_ORDER,
    getMusclesFromExerciseName,
    getExerciseVolume,
    getDurationLoad,
    document: fakeDocument,
  }, globals || {});

  const argNames = Object.keys(merged);
  const argValues = argNames.map((k) => merged[k]);
  const fn = new Function(...argNames, `${src}\n;return MuscleGrowthTracker;`);
  return { module: fn(...argValues), storage };
}

// ------------------------------------------------------------
console.log('=== 1. 칼로리 소모 추정 ===');
{
  const { module: M } = loadModule();

  const strength = { type: 'upper', fatigue: 3, duration: 60, exercises: [{ name: '벤치 프레스', weight: 60, reps: 10, sets: 3 }] };
  const cal = M.estimateWorkoutCalories(strength, 70);
  // met(5.0) * fatigueScale(1.0) * 70kg * 1h = 350
  assert(cal === 350, `상체 근력 칼로리 추정 (기대 350, 실제 ${cal})`);

  const highFatigue = { ...strength, fatigue: 5 };
  const calHigh = M.estimateWorkoutCalories(highFatigue, 70);
  assert(calHigh > cal, '피로도 높을수록 칼로리 추정치 증가');

  const noWeight = M.estimateWorkoutCalories(strength, 0);
  assert(noWeight > 0, '체중 미입력 시 기본값(65kg)으로 폴백');

  const cardio = {
    type: 'cardio',
    duration: 30,
    exercises: [
      { name: '러닝', mode: 'duration', cardioMetrics: { calories: 250 } },
      { name: '자전거', mode: 'duration', cardioMetrics: { calories: 100 } },
    ],
  };
  const cardioCal = M.estimateWorkoutCalories(cardio, 70);
  assert(cardioCal === 350, `유산소는 수동 입력 칼로리 합산 우선 (기대 350, 실제 ${cardioCal})`);

  const emptyWorkout = { type: 'full', duration: 0, exercises: [{ name: '벤치 프레스', weight: 40, reps: 8, sets: 3 }] };
  const fallbackMinutesCal = M.estimateWorkoutCalories(emptyWorkout, 70);
  assert(fallbackMinutesCal > 0, 'duration 미입력 시 종목 수 기반 추정 시간으로 폴백');
}

console.log('=== 2. 근성장 지수 ===');
{
  const { module: M } = loadModule();
  const now = new Date('2026-08-29T12:00:00');

  // 4주간 주 2회, 볼륨 점진 증가 (이전 2주 평균 < 최근 2주 평균)
  const dates = ['2026-08-01', '2026-08-04', '2026-08-08', '2026-08-11', '2026-08-15', '2026-08-18', '2026-08-22', '2026-08-25'];
  const workouts = dates.map((date, i) => ({
    date,
    exercises: [{ name: '벤치 프레스', weight: 50 + i * 2, reps: 10, sets: 3 }],
  }));

  const growth = M.computeMuscleGrowth(workouts, 'chest', now);
  assert(growth !== null, '훈련 기록이 있으면 성장 지수 계산됨');
  assert(growth.sessionCount === 8, `세션 수 집계 (기대 8, 실제 ${growth.sessionCount})`);
  assert(growth.growthPct > 0, `볼륨 증가·이상적 빈도 패턴이면 양의 성장 지수 (실제 ${growth.growthPct})`);
  assert(growth.growthPct <= 3, '성장 지수는 상한(3%)을 넘지 않음');

  const noData = M.computeMuscleGrowth([], 'chest', now);
  assert(noData === null, '기록 없는 부위는 null 반환');

  // 세션 1회만 있으면 이전 구간 데이터가 없어 중립적으로 처리되어야 함(음수 아님)
  const single = M.computeMuscleGrowth([{ date: '2026-08-25', exercises: [{ name: '벤치 프레스', weight: 50, reps: 10, sets: 3 }] }], 'chest', now);
  assert(single.growthPct >= 0, '단일 세션도 음수 성장 지수가 되지 않음');
}

console.log('=== 3. 근손실(디트레이닝) 지수 ===');
{
  const { module: M } = loadModule();
  const now = new Date('2026-08-29T12:00:00');

  const recentWorkout = [{ date: '2026-08-20', exercises: [{ name: '벤치 프레스', weight: 50, reps: 10, sets: 3 }] }]; // 9일 전
  const recentLoss = M.computeMuscleLoss(recentWorkout, 'chest', now);
  assert(recentLoss.lossPct === 0, `2주 이내는 손실 0% (실제 ${recentLoss.lossPct})`);

  const midWorkout = [{ date: '2026-07-29', exercises: [{ name: '벤치 프레스', weight: 50, reps: 10, sets: 3 }] }]; // 31일 전
  const midLoss = M.computeMuscleLoss(midWorkout, 'chest', now);
  assert(midLoss.lossPct > 0 && midLoss.lossPct < 8, `2주~8주 사이는 비례 손실 (실제 ${midLoss.lossPct})`);

  const oldWorkout = [{ date: '2026-05-01', exercises: [{ name: '벤치 프레스', weight: 50, reps: 10, sets: 3 }] }]; // 8주 이상 전
  const oldLoss = M.computeMuscleLoss(oldWorkout, 'chest', now);
  assert(oldLoss.lossPct === 8, `8주 이상은 상한값(8%)으로 클램프 (실제 ${oldLoss.lossPct})`);

  const never = M.computeMuscleLoss([], 'chest', now);
  assert(never === null, '훈련 기록 없는 부위는 null 반환');
}

console.log('=== 4. 종합 compute() ===');
{
  const { module: M } = loadModule();
  const now = new Date('2026-08-29T12:00:00');

  const empty = M.compute([], now);
  assert(empty.hasData === false, '기록이 전혀 없으면 hasData=false');
  assert(empty.overallGrowthPct === 0 && empty.overallLossPct === 0, '기록 없으면 지수 0');

  const workouts = [
    { date: '2026-08-25', exercises: [{ name: '벤치 프레스', weight: 60, reps: 10, sets: 3 }] },
    { date: '2026-05-01', exercises: [{ name: '스쿼트', weight: 80, reps: 8, sets: 3 }] },
  ];
  const result = M.compute(workouts, now);
  assert(result.hasData === true, '기록이 있으면 hasData=true');
  assert(result.perMuscle.chest.growth !== null, '가슴 성장 지수 존재');
  assert(result.perMuscle.quads.loss.lossPct === 8, '8주 이상 방치된 대퇴사두는 손실 상한');
}

console.log('=== 5. 일자별 요약 로그 저장/조회 ===');
{
  const { module: M, storage } = loadModule();
  const workout = {
    date: '2026-08-29',
    type: 'upper',
    fatigue: 3,
    duration: 45,
    exercises: [{ name: '벤치 프레스', weight: 60, reps: 10, sets: 3 }],
  };

  const summary = M.recordDailySummary(workout, 70);
  assert(summary !== null, '저장 완료 시 요약 반환');
  assert(summary.calories > 0, '요약에 칼로리 포함');
  assert(summary.muscles.includes('chest'), '요약에 자극 부위 포함');
  assert(!!storage['recovr_growth_log_v1'], 'localStorage에 로그 저장됨');

  const fetched = M.getSummaryForDate('2026-08-29');
  assert(fetched && fetched.calories === summary.calories, '저장된 요약을 날짜로 다시 조회 가능');

  const missing = M.getSummaryForDate('2000-01-01');
  assert(missing === null, '기록 없는 날짜는 null');
}

console.log('=== 6. 다른 모듈과의 연결 지점 확인 ===');
{
  const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  assert(appJs.includes('MuscleGrowthTracker.renderHomeCard()'), 'app.js renderHome()에서 홈 카드 렌더 훅 호출');

  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(indexHtml.includes('id="muscleGrowthCard"'), 'index.html에 홈 카드 컨테이너 존재');
  assert(indexHtml.includes('<script src="muscleGrowthTracker.js"></script>'), 'index.html에 스크립트 태그 등록');

  const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  assert(swJs.includes("'./muscleGrowthTracker.js'"), 'sw.js ASSETS에 등록');
  assert(swJs.includes("'/muscleGrowthTracker.js'"), 'sw.js NETWORK_FIRST_PATHS에 등록');
}

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
