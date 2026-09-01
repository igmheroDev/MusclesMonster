#!/usr/bin/env node
/**
 * RECOVR 추천 유형 확장 검증
 * - 근손실(디트레이닝) 부위 강화 추천 (muscle_loss_focus)
 * - 부위별 강화 추천 (chest_focus / back_focus / shoulder_focus / arm_focus /
 *   abs_focus / glute_ham_focus / calf_focus)
 * - 기능성 강화 추천 (balance_stability / power_explosive / endurance_boost)
 * - 카테고리(강화·보충·기능성·다이어트·모빌리티·재활) 그룹핑
 * 실행: node test-recommendation-focus-types.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// ------------------------------------------------------------
// 공용 테스트 환경 (app.js의 핵심 부위 매칭 로직을 단순화해 재현)
// ------------------------------------------------------------
const MUSCLE_ORDER = ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'quads', 'hamstrings', 'adductors', 'calves', 'core', 'forearms'];

const MUSCLE_KEYWORDS = {
  chest: ['벤치', '푸시업', '플라이', '딥스', '크로스오버'],
  back: ['랫풀다운', '로우', '풀업', '익스텐션'],
  shoulder: ['숄더', '레터럴', '오버헤드', '프론트 레이즈', '페이스 풀'],
  biceps: ['컬'],
  triceps: ['푸시다운', '트라이셉스', '스컬크러셔'],
  quads: ['스쿼트', '레그프레스', '런지'],
  hamstrings: ['힙 쓰러스트', '데드리프트', '레그컬', '글루트'],
  adductors: ['어덕션', '이너 타이'],
  calves: ['카프레이즈'],
  core: ['플랭크', '크런치', '레그레이즈', '트위스트', '휠'],
  forearms: ['리스트 컬', '파머스'],
};

function getMusclesFromExerciseName(name) {
  if (!name) return [];
  return MUSCLE_ORDER.filter((m) => (MUSCLE_KEYWORDS[m] || []).some((kw) => name.includes(kw)));
}

function getExerciseVolume(ex) {
  return (ex.weight || 0) * (ex.reps || 0) * (ex.sets || 0);
}

function getDurationLoad(ex) {
  return (ex.durationMin || 0) * 60 * 3.0;
}

function normalizeExerciseName(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, '');
}

function makeLocalStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

function loadModuleFromSource(file, exportName, extraGlobals) {
  const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const merged = Object.assign({
    MUSCLE_ORDER,
    getMusclesFromExerciseName,
    getExerciseVolume,
    getDurationLoad,
    normalizeExerciseName,
    document: { readyState: 'complete', addEventListener: () => {}, getElementById: () => null },
  }, extraGlobals || {});
  const argNames = Object.keys(merged);
  const argValues = argNames.map((k) => merged[k]);
  const fn = new Function(...argNames, `${src}\n;return ${exportName};`);
  return fn(...argValues);
}

const WorkoutUtils = loadModuleFromSource('workoutUtils.js', 'WorkoutUtils');
const UserProfile = loadModuleFromSource('userProfile.js', 'UserProfile');
const ExerciseMuscleMap = loadModuleFromSource('exerciseMuscleMap.js', 'ExerciseMuscleMap');
const MuscleGrowthTracker = loadModuleFromSource('muscleGrowthTracker.js', 'MuscleGrowthTracker');

function loadRecommendation() {
  const localStorage = makeLocalStorage();
  const WorkoutRecommendation = loadModuleFromSource('recommendation.js', 'WorkoutRecommendation', {
    WorkoutUtils,
    UserProfile,
    ExerciseMuscleMap,
    MuscleGrowthTracker,
    calcMuscleRecovery: () => ({}),
    localStorage,
  });
  return { WorkoutRecommendation, localStorage };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------
console.log('=== 1. 신규 유형 메타 · 카테고리 그룹 ===');
{
  const { WorkoutRecommendation } = loadRecommendation();
  const ids = ['muscle_loss_focus', 'chest_focus', 'back_focus', 'shoulder_focus', 'arm_focus',
    'abs_focus', 'glute_ham_focus', 'calf_focus', 'balance_stability', 'power_explosive', 'endurance_boost'];
  ids.forEach((id) => assert(!!WorkoutRecommendation.TYPE_META[id], `TYPE_META에 ${id} 존재`));
  assert(WorkoutRecommendation.TYPE_META.muscle_loss_focus.category === 'reinforce', '근손실 부위 강화 카테고리 = reinforce');
  assert(WorkoutRecommendation.TYPE_META.chest_focus.category === 'focus', '가슴 강화 카테고리 = focus');
  assert(WorkoutRecommendation.TYPE_META.power_explosive.category === 'functional', '파워 강화 카테고리 = functional');

  assert(WorkoutRecommendation.TYPE_ORDER.length >= 23, `유형 총 개수 23개 이상 (실제 ${WorkoutRecommendation.TYPE_ORDER.length})`);
  const groupLabels = WorkoutRecommendation.TYPE_GROUPS.map((g) => g.label);
  assert(groupLabels.some((l) => l.includes('보충')), '보충 카테고리 그룹 존재');
  assert(groupLabels.some((l) => l.includes('부위별')), '부위별 강화 그룹 존재');
  assert(groupLabels.some((l) => l.includes('기능성')), '기능성 그룹 존재');
  assert(groupLabels.some((l) => l.includes('다이어트')), '다이어트 그룹 존재');
  assert(groupLabels.some((l) => l === '모빌리티'), '모빌리티 단독 그룹 존재');
  assert(groupLabels.some((l) => l.includes('재활')), '재활 그룹 존재');
}

// ------------------------------------------------------------
console.log('\n=== 2. 근손실 부위 강화: MuscleGrowthTracker 연동 ===');
{
  const { WorkoutRecommendation } = loadRecommendation();
  const workouts = [];
  // 가슴: 30일 전 1회만 훈련 (장기 미훈련 → 근손실 지수 발생 목표 부위)
  workouts.push({ date: daysAgo(30), type: 'upper', exercises: [{ name: '벤치 프레스', weight: 40, reps: 10, sets: 3 }] });
  // 등/하체: 최근까지 반복 훈련 (손실 없음, 기록 기간·세션 수 충족용)
  [1, 4, 7, 10, 13].forEach((d) => {
    workouts.push({
      date: daysAgo(d),
      type: 'full',
      exercises: [
        { name: '랫풀다운', weight: 30, reps: 10, sets: 3 },
        { name: '스쿼트', weight: 50, reps: 10, sets: 3 },
      ],
    });
  });

  const { stats, scores } = WorkoutRecommendation.buildStats(workouts, {});
  assert(!!stats.muscleLossInfo, '근손실 정보 계산됨');
  assert(stats.muscleLossInfo?.muscle === 'chest', `근손실 최상위 부위 = 가슴 (실제 ${stats.muscleLossInfo?.muscle})`);
  assert(scores.muscle_loss_focus > 0, `근손실 부위 강화 점수 > 0 (실제 ${scores.muscle_loss_focus})`);

  const { WorkoutRecommendation: WR2, localStorage } = loadRecommendation();
  localStorage.setItem('recovr_rec_selected_v1', 'muscle_loss_focus');
  const rec = WR2.compute(workouts, {});
  assert(rec && rec.id === 'muscle_loss_focus', '근손실 부위 강화 유형 선택 반영');
  assert(rec.exercises.length > 0, '근손실 부위 강화 추천 운동 생성');
  assert(
    rec.exercises.some((ex) => /벤치|푸시업|플라이|딥스/.test(ex.name)),
    `근손실 부위(가슴) 맞춤 운동 포함 (실제: ${rec.exercises.map((e) => e.name).join(', ')})`
  );
}

// ------------------------------------------------------------
console.log('\n=== 3. 근손실 데이터 없을 때 정적 폴백 루틴 ===');
{
  const { WorkoutRecommendation, localStorage } = loadRecommendation();
  const workouts = [];
  // 모든 부위 최근 14일 내 반복 훈련 → 근손실 없음 (폴백 루틴 사용 기대)
  [1, 3, 5, 7, 9, 11, 13].forEach((d) => {
    workouts.push({
      date: daysAgo(d),
      type: 'full',
      exercises: [
        { name: '벤치 프레스', weight: 40, reps: 10, sets: 3 },
        { name: '랫풀다운', weight: 30, reps: 10, sets: 3 },
      ],
    });
  });
  const { stats } = WorkoutRecommendation.buildStats(workouts, {});
  assert(stats.muscleLossInfo === null, '근손실 감지 없음 → muscleLossInfo null');

  localStorage.setItem('recovr_rec_selected_v1', 'muscle_loss_focus');
  const rec = WorkoutRecommendation.compute(workouts, {});
  const presetNames = new Set(WorkoutRecommendation.EXERCISE_PRESETS.muscle_loss_focus.map((e) => e.name));
  assert(
    rec.exercises.every((ex) => presetNames.has(ex.name)),
    `근손실 미감지 시 정적 폴백 루틴 사용 (실제: ${rec.exercises.map((e) => e.name).join(', ')})`
  );
}

// ------------------------------------------------------------
console.log('\n=== 4. 부위별 강화: 상대적으로 방치된 부위 우선 추천 ===');
{
  const { WorkoutRecommendation } = loadRecommendation();
  const workouts = [];
  // 종아리를 제외한 나머지 부위는 최근 2~3일 이내 훈련
  workouts.push({ date: daysAgo(2), type: 'upper', exercises: [{ name: '벤치 프레스', weight: 40, reps: 10, sets: 3 }] });
  workouts.push({ date: daysAgo(3), type: 'upper', exercises: [{ name: '랫풀다운', weight: 30, reps: 10, sets: 3 }] });
  workouts.push({ date: daysAgo(2), type: 'upper', exercises: [{ name: '숄더 프레스', weight: 15, reps: 10, sets: 3 }] });
  workouts.push({ date: daysAgo(3), type: 'upper', exercises: [{ name: '바벨 컬', weight: 15, reps: 10, sets: 3 }] });
  workouts.push({ date: daysAgo(2), type: 'full', exercises: [{ name: '플랭크', mode: 'duration', durationMin: 1 }] });
  workouts.push({ date: daysAgo(3), type: 'lower', exercises: [{ name: '힙 쓰러스트', weight: 40, reps: 10, sets: 3 }] });
  // 종아리만 20일 전 1회 훈련 후 방치
  workouts.push({ date: daysAgo(20), type: 'lower', exercises: [{ name: '스탠딩 카프레이즈', weight: 20, reps: 15, sets: 3 }] });

  const { scores, stats } = WorkoutRecommendation.buildStats(workouts, {});
  assert(stats.muscleFocusStats.calf_focus.daysSince === 20, `종아리 미훈련 일수 계산 (실제 ${stats.muscleFocusStats.calf_focus.daysSince})`);
  assert(scores.calf_focus > scores.chest_focus, `방치된 종아리 강화 점수가 가슴 강화보다 높음 (calf=${scores.calf_focus}, chest=${scores.chest_focus})`);
  assert(scores.calf_focus > scores.back_focus, `방치된 종아리 강화 점수가 등 강화보다 높음 (calf=${scores.calf_focus}, back=${scores.back_focus})`);
}

// ------------------------------------------------------------
console.log('\n=== 5. 부위별 강화: 기록 기반 운동 추천 ===');
{
  const { WorkoutRecommendation, localStorage } = loadRecommendation();
  const workouts = [];
  for (let i = 0; i < 12; i++) {
    workouts.push({
      date: daysAgo(i),
      type: 'upper',
      exercises: [
        { name: '벤치 프레스', weight: 50, reps: 10, sets: 3 },
        { name: '인클라인 벤치 프레스', weight: 40, reps: 10, sets: 3 },
      ],
    });
  }
  localStorage.setItem('recovr_rec_selected_v1', 'chest_focus');
  const rec = WorkoutRecommendation.compute(workouts, {});
  assert(rec.id === 'chest_focus', '가슴 강화 유형 선택 반영');
  assert(rec.exercises.some((ex) => ex.name === '벤치 프레스'), '가슴 강화 추천에 기록 기반 종목(벤치 프레스) 포함');
}

// ------------------------------------------------------------
console.log('\n=== 6. 재활 필요 상태에서는 강화형 추천 억제 ===');
{
  const { WorkoutRecommendation } = loadRecommendation();
  const workouts = [];
  for (let i = 0; i < 12; i++) {
    workouts.push({
      date: daysAgo(i),
      type: i % 2 === 0 ? 'upper' : 'lower',
      exercises: [{ name: '스쿼트', weight: 40, reps: 10, sets: 3 }],
    });
  }
  const cervicalSettings = {
    profile: UserProfile.normalize({
      gender: 'female', birthYear: new Date().getFullYear() - 40, heightCm: 165, weightKg: 60,
      goal: 'rehab', condition: 'cervical_disc', experience: 'beginner',
    }),
  };
  const { scores } = WorkoutRecommendation.buildStats(workouts, cervicalSettings);
  assert(scores.muscle_loss_focus <= 0, `목디스크 상태에서 근손실 부위 강화 억제 (실제 ${scores.muscle_loss_focus})`);
  assert(scores.power_explosive <= 0, `목디스크 상태에서 파워 강화 억제 (실제 ${scores.power_explosive})`);
  assert(scores.cervical_rehab > scores.muscle_loss_focus, '목디스크 상태에서도 재활 유형이 최우선 유지');
}

// ------------------------------------------------------------
console.log('\n=== 7. 정적 검사 ===');
{
  try {
    require('child_process').execFileSync('node', ['--check', path.join(__dirname, 'recommendation.js')]);
  } catch (e) {
    assert(false, 'recommendation.js 문법 오류');
  }
}

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
