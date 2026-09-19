#!/usr/bin/env node
'use strict';

// ============================================================
// RECOVR - ExercisePicker(종목 추가 화면) 부위 분류 테스트
//
// 사용자 리포트: "운동 추가할 때 상체는 가슴/등/어깨/팔로 나뉘는데
// 하체는 '하체' 하나뿐이다 — 상체만큼 나눠달라"
//
// 수정 내용(exercisePicker.js, 독립 모듈이라 다른 모듈에는 영향 없음):
//   - 기존 단일 'lower'(하체) 칩을 상체(가슴/등/어깨)와 같은 수준으로
//     대퇴사두/둔근·햄스트링/내전·외전근/종아리 4개 칩으로 분리
//   - 라벨은 app.js의 MUSCLE_LABELS를 그대로 재사용해 홈/통계 화면과
//     명칭이 항상 일치하도록 함(문자열 이중 관리 방지)
//
// 이 테스트는 app.js를 실제로 로드해(진짜 MUSCLE_LABELS/부위 매칭 함수
// 사용) exercisePicker.js가 실제 부위 명칭·매칭 결과와 일치하는 칩을
// 만드는지 검증한다.
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

// ── app.js를 vm 컨텍스트에 로드해 실제 MUSCLE_LABELS/매칭 함수를 꺼내온다 ──
function loadAppJs() {
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const sandbox = {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    navigator: {},
    setInterval: () => 0,
    addEventListener: () => {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'app.js' });
  return { pull: (name) => vm.runInContext(name, sandbox) };
}

const { pull } = loadAppJs();
const MUSCLE_LABELS = pull('MUSCLE_LABELS');
const NON_MUSCLE_LABELS = pull('NON_MUSCLE_LABELS');
const getMusclesFromExerciseName = pull('getMusclesFromExerciseName');
const getActivityTagsFromExerciseName = pull('getActivityTagsFromExerciseName');
const normalizeExerciseName = pull('normalizeExerciseName');

// ── 가짜 DOM: getElementById로 조회되는 요소는 innerHTML을 기록하는 최소 객체 ──
function makeFakeElement(id) {
  return {
    id,
    innerHTML: '',
    value: '',
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    addEventListener() {},
    focus() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function loadExercisePicker(exerciseNames, workouts) {
  const src = fs.readFileSync(path.join(__dirname, 'exercisePicker.js'), 'utf8');
  const elements = {};
  function getElementById(id) {
    if (!elements[id]) elements[id] = makeFakeElement(id);
    return elements[id];
  }
  const document = {
    getElementById,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  const globals = {
    document,
    console,
    setTimeout: (fn) => fn(),
    encodeURIComponent,
    decodeURIComponent,
    MUSCLE_LABELS,
    NON_MUSCLE_LABELS,
    getMusclesFromExerciseName,
    getActivityTagsFromExerciseName,
    normalizeExerciseName,
    getAllExerciseNames: () => exerciseNames,
    loadWorkouts: () => workouts || [],
  };

  const argNames = Object.keys(globals);
  const argValues = argNames.map((k) => globals[k]);
  const fn = new Function(...argNames, `${src}\n;return ExercisePicker;`);
  return { module: fn(...argValues), elements };
}

// ------------------------------------------------------------
console.log('=== 1. 하체가 상체(가슴/등/어깨)와 동일한 수준으로 세분화됨 ===');
{
  const { module: EP, elements } = loadExercisePicker([]);
  EP.open(); // render() 트리거 → #exPickerChips에 칩 목록 렌더

  const chipsHtml = elements.exPickerChips.innerHTML;

  // 기존처럼 뭉뚱그린 "하체" 칩은 더 이상 없어야 함
  assert(!/data-cat="lower"/.test(chipsHtml), '단일 "lower" 카테고리 칩이 사라짐');

  // 상체 부위(가슴/등/어깨)와 동일한 개수 수준으로 하체도 개별 칩 4개 존재
  ['quads', 'hamstrings', 'adductors', 'calves'].forEach((id) => {
    assert(chipsHtml.includes(`data-cat="${id}"`), `하체 세부 부위 칩 존재: ${id}`);
  });

  // 라벨이 app.js의 실제 MUSCLE_LABELS와 정확히 일치(중복 하드코딩으로 인한 문구 불일치 방지)
  assert(chipsHtml.includes(`>${MUSCLE_LABELS.quads.name}<`), `대퇴사두 라벨이 MUSCLE_LABELS와 일치 (${MUSCLE_LABELS.quads.name})`);
  assert(chipsHtml.includes(`>${MUSCLE_LABELS.hamstrings.name}<`), `둔근/햄스트링 라벨이 MUSCLE_LABELS와 일치 (${MUSCLE_LABELS.hamstrings.name})`);
  assert(chipsHtml.includes(`>${MUSCLE_LABELS.adductors.name}<`), `내전/외전근 라벨이 MUSCLE_LABELS와 일치 (${MUSCLE_LABELS.adductors.name})`);
  assert(chipsHtml.includes(`>${MUSCLE_LABELS.calves.name}<`), `종아리 라벨이 MUSCLE_LABELS와 일치 (${MUSCLE_LABELS.calves.name})`);

  // 기존 상체 세분화(가슴/등/어깨)는 그대로 유지되어야 함(회귀 방지)
  ['chest', 'back', 'shoulder'].forEach((id) => {
    assert(chipsHtml.includes(`data-cat="${id}"`), `기존 상체 칩 유지: ${id}`);
  });
}

console.log('=== 2. 하체 운동이 세부 부위별로 정확히 분류되어 필터링됨 ===');
{
  const catalog = ['스쿼트', '레그컬', '이너타이', '카프레이즈', '벤치프레스', '데드리프트'];
  // '이너타이'는 통계 탭 유산소/근성장 리스트에서도 예시로 쓰인 운동명 —
  // 실제로 adductors(내전/외전근)로 매칭되는지 먼저 확인
  assert(JSON.stringify(getMusclesFromExerciseName('이너타이')) === JSON.stringify(['adductors']), '이너타이 → adductors 매칭 확인');
  const { module: EP, elements } = loadExercisePicker(catalog);
  EP.open();

  function itemsFor(categoryId) {
    EP.setCategory(categoryId);
    return elements.exPickerList.innerHTML;
  }

  const quadsHtml = itemsFor('quads');
  assert(quadsHtml.includes('스쿼트'), '대퇴사두 필터 → 스쿼트 포함');
  assert(!quadsHtml.includes('레그컬'), '대퇴사두 필터 → 레그컬(햄스트링)은 제외');

  const hamstringsHtml = itemsFor('hamstrings');
  assert(hamstringsHtml.includes('레그컬'), '둔근/햄스트링 필터 → 레그컬 포함');
  assert(!hamstringsHtml.includes('스쿼트'), '둔근/햄스트링 필터 → 스쿼트는 제외');

  const adductorsHtml = itemsFor('adductors');
  assert(adductorsHtml.includes('이너타이'), '내전/외전근 필터 → 이너타이 포함');
  assert(!adductorsHtml.includes('스쿼트'), '내전/외전근 필터 → 스쿼트는 제외');

  const calvesHtml = itemsFor('calves');
  assert(calvesHtml.includes('카프레이즈'), '종아리 필터 → 카프레이즈 포함');

  // 여러 부위를 동시에 자극하는 복합 운동(데드리프트: back+hamstrings)은
  // 기존처럼 상체(back)가 하체보다 우선 분류됨 — 회귀 없음 확인
  const backHtml = itemsFor('back');
  assert(backHtml.includes('데드리프트'), '복합 운동(데드리프트)은 기존처럼 back으로 분류(회귀 없음)');
}

console.log('=== 3. 상체(가슴/등/어깨)·유산소·스트레칭 필터는 기존처럼 정상 동작(회귀 없음) ===');
{
  const catalog = ['벤치프레스', '랫풀다운', '숄더프레스', '러닝', '요가'];
  const { module: EP, elements } = loadExercisePicker(catalog);
  EP.open();

  EP.setCategory('chest');
  assert(elements.exPickerList.innerHTML.includes('벤치프레스'), '가슴 필터 → 벤치프레스 포함');

  EP.setCategory('cardio');
  assert(elements.exPickerList.innerHTML.includes('러닝'), '유산소 필터 → 러닝 포함');

  EP.setCategory('mobility');
  assert(elements.exPickerList.innerHTML.includes('요가'), '스트레칭 필터 → 요가 포함');

  EP.setCategory('all');
  const allHtml = elements.exPickerList.innerHTML;
  catalog.forEach((name) => assert(allHtml.includes(name), `전체 필터 → ${name} 포함`));
}

console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : failures + ' FAILED ✗'} ===`);
process.exit(failures === 0 ? 0 : 1);
