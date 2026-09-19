#!/usr/bin/env node
'use strict';

// ============================================================
// RECOVR - app.js 성능 최적화 회귀 테스트
//
// 사용자 리포트: "기능을 많이 넣다보니 앱이 무겁고 둔한 느낌"
// 실측 결과 홈 탭(renderHome)이 운동 기록 360건 기준 약 2.7초가
// 걸렸음(회복도 계산이 부위(11개) x 전체기록을 반복 순회하며, 그 안에서
// 매번 운동명→부위 키워드 매칭을 새로 계산했기 때문). 다음 두 가지를
// 최적화했다(app.js의 계산 로직/출력값은 완전히 동일, 계산 "방법"만 개선):
//   1) getMusclesFromExerciseName / getActivityTagsFromExerciseName을
//      운동명 기준으로 메모이제이션(순수 함수라 안전) — 이 두 함수는
//      app.js 자신뿐 아니라 cardioTracker.js/exercisePicker.js/logList.js/
//      muscleGrowthTracker.js/recommendation.js/workoutAdvice.js 등 10곳
//      이상에서 재사용되므로 앱 전역 렌더 성능이 함께 개선됨
//   2) calcMuscleRecovery를 "부위(11개)마다 전체 workouts 재순회"에서
//      "workouts 1회 순회로 모든 부위 후보를 동시에 갱신"으로 재구성
//
// 이 테스트는 (a) 캐시가 결과를 오염시키지 않는지, (b) 최적화 전/후
// 알고리즘이 무작위 데이터에서 동일한 결과를 내는지(회귀 방지),
// (c) 실제로 유의미하게 빨라졌는지(성능 예산)를 검증한다.
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// app.js는 최상위 스코프에 const/function을 선언하므로(모듈로 감싸지 않음),
// 같은 vm 컨텍스트 안에서 "브라우저의 여러 <script> 태그가 렉시컬 스코프를
// 공유하는 것"과 동일한 방식으로 이름을 그대로 참조해 꺼내올 수 있다.
function loadAppJs() {
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const sandbox = {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
    },
    navigator: {},
    setInterval: () => 0,
    addEventListener: () => {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'app.js' });
  return {
    pull: (name) => vm.runInContext(name, sandbox),
  };
}

const { pull } = loadAppJs();
const getMusclesFromExerciseName = pull('getMusclesFromExerciseName');
const getActivityTagsFromExerciseName = pull('getActivityTagsFromExerciseName');
const calcMuscleRecovery = pull('calcMuscleRecovery');
const MUSCLE_ORDER = pull('MUSCLE_ORDER');
const MUSCLE_BASE_RECOVERY = pull('MUSCLE_BASE_RECOVERY');
const REFERENCE_VOLUME = pull('REFERENCE_VOLUME');
const FATIGUE_RECOVERY_SCALE = pull('FATIGUE_RECOVERY_SCALE');
const getExerciseVolume = pull('getExerciseVolume');
const getDurationLoad = pull('getDurationLoad');

console.log('=== 1. 운동명 → 부위/활동 매칭 결과가 올바름(캐싱 전과 동일한 정답) ===');
assert(JSON.stringify(getMusclesFromExerciseName('벤치프레스')) === JSON.stringify(['chest']), '벤치프레스 → chest');
assert(getMusclesFromExerciseName('데드리프트').includes('back'), '데드리프트 → back 포함');
assert(getMusclesFromExerciseName('데드리프트').includes('hamstrings'), '데드리프트 → hamstrings 포함(복합 매칭 유지)');
assert(JSON.stringify(getMusclesFromExerciseName('')) === '[]', '빈 문자열 → []');
assert(JSON.stringify(getMusclesFromExerciseName(null)) === '[]', 'null → []');
assert(JSON.stringify(getMusclesFromExerciseName(undefined)) === '[]', 'undefined → []');
assert(JSON.stringify(getActivityTagsFromExerciseName('러닝')) === JSON.stringify(['cardio']), '러닝 → cardio');
assert(JSON.stringify(getActivityTagsFromExerciseName('요가')) === JSON.stringify(['mobility']), '요가 → mobility');
assert(JSON.stringify(getActivityTagsFromExerciseName('벤치프레스')) === '[]', '근력 운동은 활동 태그 없음');

console.log('=== 2. 메모이제이션 캐시가 호출부 변형에도 오염되지 않음 ===');
const first = getMusclesFromExerciseName('벤치프레스');
first.push('POLLUTED');
const second = getMusclesFromExerciseName('벤치프레스');
assert(!second.includes('POLLUTED'), '캐시된 배열을 외부에서 push해도 다음 조회 결과는 오염되지 않음');
assert(JSON.stringify(second) === JSON.stringify(['chest']), '오염 시도 후에도 정답은 그대로');

console.log('=== 3. 같은 이름을 반복 조회해도 항상 같은 값(참조는 매번 새 배열) ===');
const a1 = getMusclesFromExerciseName('스쿼트');
const a2 = getMusclesFromExerciseName('스쿼트');
assert(a1 !== a2, '캐시 보호를 위해 매 호출마다 새 배열 인스턴스를 반환');
assert(JSON.stringify(a1) === JSON.stringify(a2), '내용은 항상 동일');

// ------------------------------------------------------------
// 4. calcMuscleRecovery: 최적화 전 알고리즘(부위마다 전체 workouts 재순회)을
//    그대로 재현해 무작위 데이터에서 최적화 후 결과와 정확히 일치하는지 검증
// ------------------------------------------------------------
function oldCalcMuscleRecovery(workouts, settings) {
  const now = new Date();
  const userScale = (settings.baseRecoveryHours || 48) / 48;
  const result = {};

  MUSCLE_ORDER.forEach((m) => {
    const muscleBase = (MUSCLE_BASE_RECOVERY[m] || 48) * userScale;
    result[m] = { volume: 0, lastDate: null, recoveryPct: 100, hoursElapsed: null, recoveryHours: Math.round(muscleBase), exercises: [] };
  });

  MUSCLE_ORDER.forEach((muscleKey) => {
    let mostRecent = null;
    let mostRecentDate = null;

    workouts.forEach((w) => {
      const wDate = new Date(w.date + 'T12:00:00');
      let sessionVolumeForMuscle = 0;
      const exNames = [];

      (w.exercises || []).forEach((ex) => {
        const muscles = getMusclesFromExerciseName(ex.name);
        if (muscles.includes(muscleKey)) {
          const vol = ex.mode === 'duration' ? getDurationLoad(ex) : getExerciseVolume(ex);
          sessionVolumeForMuscle += vol;
          exNames.push(ex.name);
        }
      });

      if (sessionVolumeForMuscle > 0 && (!mostRecentDate || wDate > mostRecentDate)) {
        mostRecentDate = wDate;
        mostRecent = { volume: sessionVolumeForMuscle, exercises: exNames, date: w.date, fatigue: w.fatigue || 3 };
      }
    });

    if (mostRecent) {
      const hoursElapsed = Math.max(0, (now - mostRecentDate) / (1000 * 60 * 60));
      const refVol = REFERENCE_VOLUME[muscleKey] || 2000;
      const intensityFactor = mostRecent.volume / refVol;
      const clampedFactor = Math.max(0.5, Math.min(2.0, intensityFactor));
      const fatigueScale = FATIGUE_RECOVERY_SCALE[mostRecent.fatigue] || 1.0;
      const muscleBase = (MUSCLE_BASE_RECOVERY[muscleKey] || 48) * userScale;
      const recoveryHours = muscleBase * clampedFactor * fatigueScale;
      const pct = Math.max(0, Math.min(100, Math.round((hoursElapsed / recoveryHours) * 100)));

      result[muscleKey] = {
        volume: mostRecent.volume,
        lastDate: mostRecent.date,
        recoveryPct: pct,
        hoursElapsed: Math.round(hoursElapsed),
        recoveryHours: Math.round(recoveryHours),
        exercises: mostRecent.exercises,
      };
    }
  });

  return result;
}

const EXERCISE_NAMES = [
  '벤치프레스', '스쿼트', '데드리프트', '오버헤드프레스', '풀업', '레그프레스',
  '바벨로우', '이두컬', '삼두익스텐션', '레그컬', '카프레이즈', '플랭크',
  '러닝', '자전거', '없는운동이름xyz', '숄더 레터럴 레이즈',
];

function randomWorkouts(count, dateSpread) {
  const workouts = [];
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(Math.random() * dateSpread);
    const d = new Date('2025-01-01T00:00:00');
    d.setDate(d.getDate() + dayOffset);
    const numEx = 1 + Math.floor(Math.random() * 4);
    const exercises = [];
    for (let j = 0; j < numEx; j++) {
      const name = EXERCISE_NAMES[Math.floor(Math.random() * EXERCISE_NAMES.length)];
      if (name === '러닝' || name === '자전거') {
        exercises.push({ name, mode: 'duration', durationMin: 10 + Math.floor(Math.random() * 40) });
      } else {
        exercises.push({
          name,
          mode: 'weight',
          setDetails: Array.from({ length: 1 + Math.floor(Math.random() * 4) }).map(() => ({
            weight: Math.floor(Math.random() * 100),
            reps: 1 + Math.floor(Math.random() * 12),
            completed: Math.random() > 0.1,
          })),
        });
      }
    }
    workouts.push({ date: d.toISOString().slice(0, 10), fatigue: 1 + Math.floor(Math.random() * 5), exercises });
  }
  return workouts;
}

console.log('=== 5. calcMuscleRecovery 최적화 전/후 알고리즘 무작위 대조(회귀 방지) ===');
let mismatches = 0;
const TRIALS = 60;
for (let t = 0; t < TRIALS; t++) {
  const count = Math.floor(Math.random() * 40);
  const spread = 5 + Math.floor(Math.random() * 60);
  const workouts = randomWorkouts(count, spread);
  const settings = { baseRecoveryHours: [36, 48, 60][t % 3] };

  const oldResult = oldCalcMuscleRecovery(workouts, settings);
  const newResult = calcMuscleRecovery(workouts, settings);

  if (JSON.stringify(oldResult) !== JSON.stringify(newResult)) {
    mismatches++;
    if (mismatches <= 1) {
      console.error(`  불일치 예시(trial ${t}): count=${count}, spread=${spread}`);
    }
  }
}
assert(mismatches === 0, `${TRIALS}회 무작위 비교 중 ${mismatches}건 불일치 (0이어야 함)`);

console.log('=== 6. 성능 예산: 워크아웃 300건 기준 calcMuscleRecovery가 충분히 빠름 ===');
const bigWorkouts = randomWorkouts(300, 300);
const t0 = Date.now();
calcMuscleRecovery(bigWorkouts, { baseRecoveryHours: 48 });
const elapsed = Date.now() - t0;
console.log(`  워크아웃 300건 계산 소요 시간: ${elapsed}ms`);
// 최적화 전 알고리즘은 이 규모에서 초 단위가 걸렸음(부위 11개 x 전체 재순회 +
// 매 호출마다 200개 이상 키워드 재정규화). 넉넉한 예산(500ms)으로도 회귀를 잡아낸다.
assert(elapsed < 500, `계산이 500ms 안에 끝나야 함(실측 ${elapsed}ms) — 느려지면 최적화가 깨진 것`);

console.log('=== 7. 완성된 계산 로직의 "출력값"은 그대로 유지됨(동작 변경 없음, 방법만 최적화) ===');
const fixedWorkouts = [
  { date: '2025-01-01', fatigue: 3, exercises: [{ name: '벤치프레스', mode: 'weight', setDetails: [{ weight: 60, reps: 10, completed: true }] }] },
];
const fixedResult = calcMuscleRecovery(fixedWorkouts, { baseRecoveryHours: 48 });
assert(fixedResult.chest.volume === 600, '가슴 볼륨 = 60kg x 10회 = 600');
assert(fixedResult.chest.lastDate === '2025-01-01', '가슴 최근 훈련일 반영');
assert(fixedResult.back.lastDate === null, '등은 훈련 기록 없음(회복 100% 유지)');
assert(fixedResult.back.recoveryPct === 100, '등 회복도 100%');

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
