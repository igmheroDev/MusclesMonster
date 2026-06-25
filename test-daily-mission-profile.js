#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

function loadDailyMission(profileRef, storage) {
  const src = fs.readFileSync(path.join(__dirname, 'dailyMission.js'), 'utf8');
  const localStorage = {
    getItem: key => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: key => { delete storage[key]; },
  };
  const UserProfile = {
    normalize(profile) {
      return {
        goal: profile?.goal || '',
        condition: profile?.condition || 'none',
        injuryNotes: profile?.injuryNotes || '',
      };
    },
  };
  const loadSettings = () => ({ profile: profileRef.current });
  return new Function('localStorage', 'loadSettings', 'UserProfile', src + '; return DailyMission;')(
    localStorage,
    loadSettings,
    UserProfile
  );
}

const storage = {};
const profileRef = { current: { goal: '', condition: 'none', injuryNotes: '' } };
const DailyMission = loadDailyMission(profileRef, storage);
const date = '2026-06-25';

console.log('=== 1. 명시 상태별 미션 전환 ===');
profileRef.current = { goal: '', condition: 'cervical_disc', injuryNotes: '' };
assert(DailyMission.getMissionContext().key === 'cervical_disc', '목디스크 상태 감지');
const neckNames = DailyMission.getMissionsForDate(date).map(m => m.name).join(',');
assert(!/버피|점프|싯업|러시안/.test(neckNames), `목디스크 미션에 고충격/비틀림 동작 포함: ${neckNames}`);
assert(/턱|견갑|호흡|벽|어깨|가슴|걷기|등척성/.test(neckNames), `목디스크 맞춤 미션 아님: ${neckNames}`);

profileRef.current = { goal: '', condition: 'lumbar_disc', injuryNotes: '' };
assert(DailyMission.getMissionContext().key === 'lumbar_disc', '허리디스크 상태 감지');
const backNames = DailyMission.getMissionsForDate(date).map(m => m.name).join(',');
assert(!/버피|점프|싯업|러시안|마운틴/.test(backNames), `허리디스크 미션에 부담 동작 포함: ${backNames}`);
assert(/골반|버드독|데드버그|걷기|브릿지|캣카우|힐|힙힌지|호흡|무릎/.test(backNames), `허리디스크 맞춤 미션 아님: ${backNames}`);

profileRef.current = { goal: 'fat_loss', condition: 'none', injuryNotes: '' };
assert(DailyMission.getMissionContext().key === 'fat_loss', '체중감량 목표 감지');
const fatLossNames = DailyMission.getMissionsForDate(date).map(m => m.name).join(',');
assert(/걷기|스텝|유산소|스쿼트|월싯|카프|의자|벽/.test(fatLossNames), `체중감량 저충격 미션 아님: ${fatLossNames}`);

console.log('=== 2. 메모 기반 상태 감지 ===');
profileRef.current = { goal: '', condition: 'none', injuryNotes: '목디스크 재활 중' };
assert(DailyMission.getMissionContext().key === 'cervical_disc', '목디스크 메모 감지');
profileRef.current = { goal: '', condition: 'none', injuryNotes: '허리 디스크 주의' };
assert(DailyMission.getMissionContext().key === 'lumbar_disc', '허리디스크 메모 감지');
profileRef.current = { goal: 'rehab', condition: 'none', injuryNotes: '' };
assert(DailyMission.getMissionContext().key === 'rehab_general', '재활 목표 감지');

console.log('=== 3. 완료 도장 보존 및 부분 완료 정렬 ===');
profileRef.current = { goal: '', condition: 'cervical_disc', injuryNotes: '' };
const neckMissions = DailyMission.getMissionsForDate(date);
neckMissions.forEach(m => DailyMission.toggleMission(date, m.id));
assert(DailyMission.isDayCompleted(date), '목디스크 미션 완료');

profileRef.current = { goal: 'fat_loss', condition: 'none', injuryNotes: '' };
assert(DailyMission.isDayCompleted(date), '프로필 변경 후 완료 도장 보존');

const partialDate = '2026-06-26';
profileRef.current = { goal: '', condition: 'cervical_disc', injuryNotes: '' };
const oldId = DailyMission.getMissionsForDate(partialDate)[0].id;
DailyMission.toggleMission(partialDate, oldId);

profileRef.current = { goal: 'fat_loss', condition: 'none', injuryNotes: '' };
const currentIds = DailyMission.getMissionsForDate(partialDate).map(m => m.id);
const completedAfterChange = DailyMission.getCompletedForDate(partialDate);
assert(completedAfterChange.every(id => currentIds.includes(id)), '부분 완료 기록은 새 상태 미션 기준으로 정렬');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
