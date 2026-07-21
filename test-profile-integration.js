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
const currentYear = new Date().getFullYear();

assert(UserProfile.normalize({ birthYear: '' }).birthYear === null, '빈 출생년 → null');
assert(UserProfile.normalize({ heightCm: '' }).heightCm === null, '빈 키 → null');
assert(UserProfile.calcBmi(175, 70) === 22.9, 'BMI 22.9');

// 레거시 age → birthYear 마이그레이션
const migrated = UserProfile.normalize({ age: 45 });
assert(migrated.birthYear === currentYear - 45, `age 45 → birthYear ${currentYear - 45}`);
assert(UserProfile.getAge(migrated) === 45, '마이그레이션 후 나이 45');
assert(migrated.age === undefined, 'normalize 결과에 age 필드 없음');

const complete = UserProfile.normalize({
  gender: 'male', birthYear: currentYear - 45, heightCm: 175, weightKg: 80,
  goal: 'hypertrophy', condition: 'lumbar_disc', experience: 'beginner', daysPerWeek: 3,
});
assert(UserProfile.isComplete(complete), '완전 프로필');
assert(complete.condition === 'lumbar_disc', '현재 상태 normalize');
assert(UserProfile.getConditionLabel('lumbar_disc').includes('허리디스크'), '현재 상태 라벨');
assert(UserProfile.getAge(complete) === 45, 'getAge 45');
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
assert(
  UserProfile.formatForAI(complete).includes('허리디스크'),
  '완성 프로필 AI 포맷 현재 상태'
);
assert(
  UserProfile.formatForAI(complete).includes('출생년'),
  'AI 포맷에 출생년 포함'
);

const bad = UserProfile.normalize({ gender: 'hack', goal: 'evil', condition: 'bad', birthYear: 'x', age: 'x' });
assert(bad.gender === '' && bad.goal === '' && bad.condition === 'none' && bad.birthYear === null, 'sanitize');

const bounds = UserProfile.getBirthYearBounds();
assert(bounds.min === currentYear - 100 && bounds.max === currentYear - 10, '출생년 범위');

console.log('\n=== 2. saveSettings 프로필 유지 (버그 재현/수정 검증) ===');
const storage = {};
const loadSettings = () => {
  const raw = storage.settings || '{"baseRecoveryHours":48}';
  const settings = JSON.parse(raw);
  return UserProfile.mergeIntoSettings(settings);
};
const saveSettingsToStorage = (s) => { storage.settings = JSON.stringify(s); };

const profile = UserProfile.normalize({
  gender: 'male', birthYear: currentYear - 30, heightCm: 180, weightKg: 75,
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
assert(after.profile?.birthYear === currentYear - 30, '회복 기준값만 변경해도 프로필 유지');
assert(UserProfile.getAge(after.profile) === 30, '저장된 출생년으로 나이 30');
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
assert(loadSettings().profile?.birthYear == null, '버그 시나리오: 빈 폼이면 프로필 소실 확인');

// 백업/구버전 JSON에 age만 있어도 merge 시 birthYear로 변환
saveSettingsToStorage({
  baseRecoveryHours: 48,
  profile: { gender: 'male', age: 32, heightCm: 175, weightKg: 70, goal: 'maintain', experience: '1to3years' },
});
const legacyLoaded = loadSettings();
assert(legacyLoaded.profile.birthYear === currentYear - 32, 'load 시 age→birthYear 마이그레이션');
assert(UserProfile.getAge(legacyLoaded.profile) === 32, '마이그레이션 나이 유지');
assert(legacyLoaded.profile.age === undefined, '저장 프로필에 age 제거');
// birthYear가 있으면 낡은 age는 무시 (해가 바뀌어도 출생년 고정)
const preferBirthYear = UserProfile.normalize({ birthYear: 1990, age: 20 });
assert(preferBirthYear.birthYear === 1990, 'birthYear 우선 (age 무시)');
assert(UserProfile.getAge(preferBirthYear) === currentYear - 1990, '고정 출생년으로 나이 계산');

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
assert(recJs.includes('UserProfile.getAge'), '추천에서 getAge 사용');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptOrder = html.indexOf('app.js') < html.indexOf('userProfile.js')
  && html.indexOf('userProfile.js') < html.indexOf('recommendation.js');
assert(scriptOrder, '스크립트 로드 순서');
assert(html.includes('profileBirthYear'), '출생년 입력 필드');
assert(!html.includes('id="profileAge"'), '나이 입력 필드 제거');

const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
assert(sw.includes('./userProfile.js'), 'sw 캐시 userProfile.js');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
