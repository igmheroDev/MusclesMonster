#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error('FAIL:', message);
  }
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

function makeElement() {
  return {
    textContent: '',
    dataset: {},
    children: [],
    _innerHTML: '',
    set innerHTML(value) {
      this._innerHTML = value;
      if (value === '') this.children = [];
    },
    get innerHTML() { return this._innerHTML; },
    appendChild(child) { this.children.push(child); },
  };
}

const elements = {
  hssInsightSource: makeElement(),
  hssInsightTitle: makeElement(),
  hssInsightSummary: makeElement(),
  hssInsightList: makeElement(),
};
global.document = {
  getElementById: (id) => elements[id] || null,
  createElement: () => makeElement(),
};

global.MUSCLE_LABELS = { chest: { name: '가슴' } };
global.UserProfile = { formatForAI: () => '목표: 근비대' };
global.WorkoutRecommendation = {
  compute: () => ({ label: '가슴 강화', reason: '최근 가슴 빈도가 낮음' }),
};
global.WorkoutAdvice = {
  compute: () => [{ title: '균형', message: '등 운동도 함께 진행하세요.' }],
};

const HomeCoachInsight = new Function(
  fs.readFileSync(path.join(__dirname, 'homeCoachInsight.js'), 'utf8') + '; return HomeCoachInsight;'
)();

const workouts = [
  { date: daysAgo(40), type: 'upper', exercises: [] },
  {
    date: daysAgo(2),
    type: 'upper',
    fatigue: 3,
    exercises: [{
      name: '벤치 프레스',
      setDetails: [{ weight: 60, reps: 10, completed: true }],
    }],
  },
  { date: daysAgo(1), inProgress: true, exercises: [] },
];
const context = {
  settings: { profile: { goal: 'hypertrophy' }, baseRecoveryHours: 48 },
  workouts,
  recovery: { chest: { lastDate: daysAgo(2), recoveryPct: 75 } },
  recoveryPct: 75,
  muscleOrder: ['chest'],
};

(async () => {
  console.log('=== 1. 기간·응답 처리 ===');
  const recent = HomeCoachInsight.getRecentWorkouts(workouts);
  assert(recent.length === 1 && recent[0].date === daysAgo(2), '최근 완료 기록만 선택');

  const requestContext = HomeCoachInsight.buildRequestContext(context);
  assert(requestContext.includes('최근 28일'), '분석 기간 포함');
  assert(requestContext.includes('벤치 프레스'), '운동 기록 포함');
  assert(requestContext.includes('가슴 75%'), '회복 상태 포함');

  const parsed = HomeCoachInsight.parseResponse(
    '```json\n{"title":"훈련 가능","summary":"가슴 회복이 진행됐어요.","advice":["가볍게 시작하세요."]}\n```'
  );
  assert(parsed.title === '훈련 가능' && parsed.advice.length === 1, 'JSON 응답 파싱');

  console.log('\n=== 2. 키 없음 로컬 폴백 ===');
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    throw new Error('호출되면 안 됨');
  };
  await HomeCoachInsight.render({ ...context, settings: { ...context.settings, geminiApiKey: '' } });
  assert(fetchCount === 0, '키가 없으면 API 미호출');
  assert(elements.hssInsightSource.textContent.includes('로컬 분석'), '로컬 분석 표시');

  console.log('\n=== 3. Gemini 자동 분석·캐시 ===');
  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                title: '가슴 회복 후 균형 훈련',
                summary: '최근 기록상 가슴 회복은 75%예요.',
                advice: ['강도를 낮춰 시작하세요.', '등 운동을 보강하세요.'],
              }),
            }],
          },
        }],
      }),
    };
  };

  const aiContext = {
    ...context,
    settings: { ...context.settings, geminiApiKey: 'test-key' },
  };
  await HomeCoachInsight.render(aiContext);
  assert(elements.hssInsightSource.dataset.state === 'ai', 'AI 분석 출처 표시');
  assert(elements.hssInsightTitle.textContent.includes('균형 훈련'), 'AI 제목 반영');
  assert(elements.hssInsightList.children.length === 2, 'AI 조언 목록 반영');
  assert(storage.has(HomeCoachInsight.CACHE_KEY), 'AI 결과 캐시 저장');

  const beforeCachedRender = fetchCount;
  await HomeCoachInsight.render(aiContext);
  assert(fetchCount === beforeCachedRender, '같은 기록은 캐시 사용');

  console.log('\n=== 4. 정적 연동 ===');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  assert(html.includes('homeCoachInsight.js'), '스크립트 로드');
  assert(!html.includes('id="workoutAdviceCard"'), '별도 운동 조언 카드 제거');
  assert(app.includes('HomeCoachInsight.render(summaryContext)'), '홈 렌더 연결');
  assert(sw.includes('./homeCoachInsight.js'), 'SW 캐시 연결');
  assert(sw.includes('recovr-cache-v77'), 'SW 캐시 버전');

  require('child_process').execFileSync('node', ['--check', path.join(__dirname, 'homeCoachInsight.js')]);
  console.log(`\n=== 최종: ${failures === 0 ? 'ALL PASSED ✓' : `${failures} FAILED ✗`} ===`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
