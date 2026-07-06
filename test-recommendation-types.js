#!/usr/bin/env node
/**
 * RECOVR 홈 추천 유형 확장 검증
 * 실행: node test-recommendation-types.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

function loadModule(file, exportName) {
  return new Function(
    fs.readFileSync(path.join(__dirname, file), 'utf8') + `; return ${exportName};`
  )();
}

const UserProfile = loadModule('userProfile.js', 'UserProfile');
global.UserProfile = UserProfile;

global.WorkoutUtils = loadModule('workoutUtils.js', 'WorkoutUtils');

global.calcMuscleRecovery = () => ({});
global.getMusclesFromExerciseName = () => [];
global.getExerciseVolume = () => 0;
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};

const WorkoutRecommendation = loadModule('recommendation.js', 'WorkoutRecommendation');

console.log('=== 1. 유형 메타 ===');
assert(WorkoutRecommendation.TYPE_ORDER.length >= 12, '12개 이상 유형');
assert(WorkoutRecommendation.TYPE_META.fat_loss?.label === '체중감소', '체중감소 유형');
assert(WorkoutRecommendation.TYPE_META.cervical_rehab?.label === '목디스크 재활', '목디스크 재활');
assert(WorkoutRecommendation.TYPE_META.lumbar_rehab?.label === '허리 재활', '허리 재활');
assert(WorkoutRecommendation.TYPE_META.functional_cardio?.workoutType === 'cardio', '기능성 유산소 → cardio');

console.log('\n=== 2. 상태 감지 ===');
assert(
  WorkoutRecommendation.detectEffectiveCondition({ condition: 'cervical_disc' }) === 'cervical_disc',
  '목디스크 상태'
);
assert(
  WorkoutRecommendation.detectEffectiveCondition({ injuryNotes: '허리디스크 주의' }) === 'lumbar_disc',
  '허리 메모 감지'
);
assert(
  WorkoutRecommendation.detectEffectiveCondition({ goal: 'fat_loss', condition: 'none' }) === 'fat_loss',
  '체중감량 목표'
);

console.log('\n=== 3. 점수·자동 추천 ===');
const workouts = [];
for (let i = 0; i < 12; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  workouts.push({
    date: d.toISOString().slice(0, 10),
    type: i % 2 === 0 ? 'upper' : 'lower',
    exercises: [{ name: '스쿼트', weight: 40, reps: 10, sets: 3 }],
  });
}

const cervicalSettings = {
  profile: UserProfile.normalize({
    gender: 'female', age: 40, heightCm: 165, weightKg: 60,
    goal: 'rehab', condition: 'cervical_disc', experience: 'beginner',
  }),
};

const { scores: cervicalScores, autoTypeId: cervicalAuto } = WorkoutRecommendation.buildStats(workouts, cervicalSettings);
assert(cervicalScores.cervical_rehab > cervicalScores.upper_growth, '목디스크 → 재활 유형 우선');
assert(cervicalAuto === 'cervical_rehab', `목디스크 자동 추천 (${cervicalAuto})`);

const fatSettings = {
  profile: UserProfile.normalize({
    gender: 'male', age: 35, heightCm: 175, weightKg: 92,
    goal: 'fat_loss', condition: 'fat_loss', experience: 'under1year',
  }),
};
const { autoTypeId: fatAuto, scores: fatScores } = WorkoutRecommendation.buildStats(workouts, fatSettings);
assert(
  fatScores.fat_loss >= fatScores.upper_maintain || fatAuto === 'fat_loss' || fatAuto === 'functional_cardio',
  '체중감량 프로필에서 체형·유산소 유형 상위'
);

const rec = WorkoutRecommendation.compute(workouts, cervicalSettings);
assert(rec && rec.exercises.length > 0, '추천 운동 목록 생성');
assert(rec.exercises.some(ex => ex.name.includes('턱') || ex.name.includes('견갑')), '목 재활 프리셋 반영');

console.log('\n=== 4. 정적 검사 ===');
try {
  require('child_process').execFileSync('node', ['--check', path.join(__dirname, 'recommendation.js')]);
} catch (e) {
  assert(false, 'recommendation.js 문법 오류');
}

const recJs = fs.readFileSync(path.join(__dirname, 'recommendation.js'), 'utf8');
assert(recJs.includes('TYPE_GROUPS'), '유형 그룹 optgroup');
assert(recJs.includes('fat_loss'), '체중감소 키');
assert(recJs.includes('functional_cardio'), '기능성 유산소 키');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
