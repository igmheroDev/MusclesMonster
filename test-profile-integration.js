#!/usr/bin/env node
/**
 * RECOVR 프로필 검증 스크립트
 * 실행: node test-profile-integration.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

function loadUserProfile() {
  return new Function(
    fs.readFileSync(path.join(__dirname, 'userProfile.js'), 'utf8') + '; return UserProfile;'
  )();
}

console.log('=== 1. UserProfile 단위 테스트 ===');
const UserProfile = loadUserProfile();

assert(UserProfile.normalize({ age: '' }).age === null, '빈 나이 → null');
assert(UserProfile.normalize({ heightCm: '' }).heightCm === null, '빈 키 → null');
assert(UserProfile.calcBmi(175, 70) === 22.9, 'BMI 22.9');

const complete = UserProfile.normalize({
  gender: 'male', age: 45, heightCm: 175, weightKg: 80,
  goal: 'hypertrophy', experience: 'beginner', daysPerWeek: 3,
});
assert(UserProfile.isComplete(complete), '완전 프로필');
const scale = UserProfile.getRecoveryScale({ baseRecoveryHours: 48, profile: complete });
assert(scale > 1 && scale < 2, `회복 스케일 범위 (${scale.toFixed(3)})`);

const scores = { upper_growth: 50, upper_maintain: 30, lower_growth: 40, lower_maintain: 20 };
const adj = UserProfile.applyGoalToScores(scores, complete, 3);
assert(adj.upper_growth < scores.upper_growth, '주당 한도 → growth 감소');
assert(adj.upper_maintain > scores.upper_maintain, '주당 한도 → maintain 증가');

assert(
  UserProfile.formatForAI({}).includes('미입력'),
  '미완성 프로필 AI 포맷'
);
assert(
  UserProfile.formatForAI(complete).includes('근비대'),
  '완성 프로필 AI 포맷'
);

const bad = UserProfile.normalize({ gender: 'hack', goal: 'evil', age: 'x' });
assert(bad.gender === '' && bad.goal === '' && bad.age === null, 'sanitize');

console.log('\n=== 2. saveSettings 프로필 유지 (버그 재현/수정 검증) ===');
const storage = {};
const loadSettings = () => {
  const raw = storage.settings || '{"baseRecoveryHours":48}';
  const settings = JSON.parse(raw);
  return UserProfile.mergeIntoSettings(settings);
};
const saveSettingsToStorage = (s) => { storage.settings = JSON.stringify(s); };

const profile = UserProfile.normalize({
  gender: 'male', age: 30, heightCm: 180, weightKg: 75,
  goal: 'hypertrophy', experience: 'under1year',
});
saveSettingsToStorage({ baseRecoveryHours: 48, profile });

// 수정된 saveSettings 로직 (profile 폼 미읽기)
function saveSettingsFixed(baseRecoveryHoursValue) {
  const settings = loadSettings();
  settings.baseRecoveryHours = parseInt(baseRecoveryHoursValue, 10) || 48;
  saveSettingsToStorage(settings);
}

saveSettingsFixed(56);
const after = loadSettings();
assert(after.profile?.age === 30, '회복 기준값만 변경해도 프로필 유지');
assert(after.baseRecoveryHours === 56, '회복 기준값 반영');

// 이전 버그 로직이면 프로필이 지워짐
function saveSettingsBuggy(emptyFormProfile) {
  const settings = loadSettings();
  settings.baseRecoveryHours = 56;
  settings.profile = emptyFormProfile;
  saveSettingsToStorage(settings);
}
saveSettingsToStorage({ baseRecoveryHours: 48, profile });
saveSettingsBuggy(UserProfile.normalize({}));
assert(loadSettings().profile?.age == null, '버그 시나리오: 빈 폼이면 프로필 소실 확인');

console.log('\n=== 3. 정적 연동 검사 ===');
for (const file of ['app.js', 'recommendation.js', 'aiCoach.js', 'index.html', 'sw.js']) {
  try {
    if (file.endsWith('.js')) {
      require('child_process').execFileSync('node', ['--check', path.join(__dirname, file)]);
    }
  } catch (e) {
    assert(false, `${file} 문법 오류`);
  }
}

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(!appJs.includes('settings.profile = UserProfile.readFromForm()'), 'saveSettings에서 profile 폼 읽기 제거됨');
assert(appJs.includes('UserProfile.fillForm(loadSettings())'), 'init에서 fillForm 호출');
assert(appJs.includes('UserProfile.fillForm(loadSettings())', appJs.indexOf('importData')), 'import 후 fillForm');

const recJs = fs.readFileSync(path.join(__dirname, 'recommendation.js'), 'utf8');
assert(recJs.includes('UserProfile.normalize(settings.profile)'), 'buildReason normalize');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptOrder = html.indexOf('app.js') < html.indexOf('userProfile.js')
  && html.indexOf('userProfile.js') < html.indexOf('recommendation.js');
assert(scriptOrder, '스크립트 로드 순서');

const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(sw.includes('./userProfile.js'), 'sw 캐시 userProfile.js');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
