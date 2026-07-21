#!/usr/bin/env node
/**
 * 홈 상태 서머리 + 선택 프로필 필드 검증
 * 실행: node test-home-status-summary.js
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

console.log('=== 1. 선택 프로필 필드 ===');
const UserProfile = loadModule('userProfile.js', 'UserProfile');
const year = new Date().getFullYear();

const partial = UserProfile.normalize({
  heightCm: 175, weightKg: 80,
  sleepHours: '5to6', jobActivity: 'sedentary', waistCm: 92, stressLevel: 'high',
});
assert(partial.sleepHours === '5to6', '수면 선택값 유지');
assert(partial.jobActivity === 'sedentary', '활동량 유지');
assert(partial.waistCm === 92, '허리둘레 유지');
assert(partial.stressLevel === 'high', '스트레스 유지');
assert(!UserProfile.isComplete(partial), '선택 필드만으로는 미완성');

const badOpt = UserProfile.normalize({ sleepHours: 'hack', jobActivity: 'x', stressLevel: 1, waistCm: 9 });
assert(badOpt.sleepHours === '' && badOpt.jobActivity === '' && badOpt.stressLevel === '', '선택값 sanitize');
assert(badOpt.waistCm === null, '허리둘레 범위 밖 → null');

const summary = UserProfile.getHomeSummary({ heightCm: 175, weightKg: 70 });
assert(summary.includes('BMI'), '키·몸무게만 있어도 BMI 표시');
assert(UserProfile.getBmiCategory(22)?.key === 'normal', 'BMI 정상 구간');
assert(UserProfile.getWaistRisk(92, 'male')?.key === 'high', '남성 허리 위험');

const complete = UserProfile.normalize({
  gender: 'male', birthYear: year - 35, heightCm: 175, weightKg: 80,
  goal: 'fat_loss', experience: '1to3years', sleepHours: 'under5', waistCm: 95,
});
assert(UserProfile.formatForAI(complete).includes('수면'), 'AI 포맷에 수면');
assert(UserProfile.formatForAI(complete).includes('허리둘레'), 'AI 포맷에 허리');

console.log('\n=== 2. HomeStatusSummary 빌드 ===');
global.UserProfile = UserProfile;
global.WorkoutAdvice = { compute: () => [{ type: 'balance', message: '상하체 균형을 맞춰보세요.' }] };
global.WorkoutRecommendation = {
  compute: () => ({
    icon: '🦵', label: '하체 유지', reason: '회복 중이라 유지 운동을 권장해요.',
    exercises: [{ name: '레그프레스' }, { name: '런지' }],
  }),
};
const HomeStatusSummary = loadModule('homeStatusSummary.js', 'HomeStatusSummary');

const built = HomeStatusSummary.build({
  settings: { profile: complete },
  workouts: [{}],
  recoveryPct: 55,
  overallDesc: '회복 진행 중',
});
assert(built.status.title.includes('회복'), '상태 타이틀에 회복');
assert(built.status.detail.includes('BMI'), '상태에 BMI');
assert(built.workout.title.includes('하체'), '추천 운동 반영');
assert(built.lifestyle.some((t) => t.includes('수면') || t.includes('허리')), '생활습관에 선택 필드 반영');
assert(!built.emptyHint, '프로필 있으면 emptyHint 없음');

const emptyBuilt = HomeStatusSummary.build({ settings: { profile: {} }, recoveryPct: null });
assert(!!emptyBuilt.emptyHint, '빈 프로필이면 안내');

console.log('\n=== 3. 정적 연동 ===');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(html.includes('id="homeStatusSummary"'), '홈 카드 컨테이너');
assert(html.includes('homeStatusSummary.js'), '스크립트 로드');
assert(html.includes('profileSleepHours'), '수면 필드');
assert(html.includes('profileWaist'), '허리 필드');
assert(html.includes('profileJobActivity'), '활동량 필드');
assert(html.includes('profileStressLevel'), '스트레스 필드');

const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(sw.includes('homeStatusSummary.js'), 'SW 캐시 포함');
assert(sw.includes('recovr-cache-v58'), '캐시 버전');

const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(app.includes('HomeStatusSummary.render'), 'renderHome 연동');

require('child_process').execFileSync('node', ['--check', path.join(__dirname, 'homeStatusSummary.js')]);
require('child_process').execFileSync('node', ['--check', path.join(__dirname, 'userProfile.js')]);

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
