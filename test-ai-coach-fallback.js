#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

global.WorkoutUtils = {
  getWorkoutsInLookback(workouts, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return workouts.filter((w) => new Date(`${w.date}T12:00:00`) >= cutoff);
  },
};

global.MUSCLE_ORDER = ['chest', 'back', 'shoulder'];
global.MUSCLE_LABELS = {
  chest: { name: '가슴' },
  back: { name: '등' },
  shoulder: { name: '어깨' },
};

global.loadWorkouts = () => [];
global.getCompletedWorkouts = () => [];
global.loadSettings = () => ({ baseRecoveryHours: 48, profile: { daysPerWeek: 3 } });
global.calcMuscleRecovery = () => ({
  chest: { lastDate: '2026-07-01', recoveryPct: 90 },
  back: { lastDate: '2026-07-01', recoveryPct: 55 },
  shoulder: { lastDate: '2026-07-01', recoveryPct: 80 },
});

global.WorkoutRecommendation = {
  compute: () => ({
    label: '상체 성장',
    reason: '상체 볼륨이 낮아요',
    exercises: [{ name: '벤치 프레스', sets: 3, weight: 60, reps: 10 }],
  }),
};

global.WorkoutAdvice = {
  compute: () => [{
    icon: '⚖️',
    title: '푸시·풀 균형',
    message: '등 운동을 보강하세요.',
  }],
};

const AiCoachFallback = new Function(
  fs.readFileSync(path.join(__dirname, 'aiCoachFallback.js'), 'utf8') + '; return AiCoachFallback;'
)();

assert(AiCoachFallback.shouldUseFallback({ message: 'RATE_LIMIT' }), 'rate limit');
assert(AiCoachFallback.shouldUseFallback({ message: 'NETWORK_ERROR' }), 'network error');
assert(!AiCoachFallback.shouldUseFallback({ message: 'INVALID_KEY' }), 'not invalid key');

assert(AiCoachFallback.detectIntent('오늘 뭐 운동하면 좋을까?') === 'today', 'today intent');
assert(AiCoachFallback.detectIntent('이번 주 운동 계획 짜줘') === 'weekly', 'weekly intent');
assert(AiCoachFallback.detectIntent('푸시/풀 밸런스 어때?') === 'balance', 'balance intent');
assert(AiCoachFallback.detectIntent('회복 안 된 부위 알려줘') === 'recovery', 'recovery intent');

const reply = AiCoachFallback.buildFallbackReply('오늘 뭐 운동하면 좋을까?');
assert(reply.includes('[규칙 기반 답변]'), 'has prefix');
assert(reply.includes('상체 성장'), 'includes recommendation');
assert(reply.includes('벤치 프레스'), 'includes exercise');

const recoveryReply = AiCoachFallback.buildFallbackReply('회복 안 된 부위 알려줘');
assert(recoveryReply.includes('등'), 'low recovery muscle');

const aiJs = fs.readFileSync(path.join(__dirname, 'aiCoach.js'), 'utf8');
assert(aiJs.includes('AiCoachFallback.shouldUseFallback'), 'aiCoach.js fallback hook');
assert(aiJs.includes('AiCoachFallback.buildFallbackReply'), 'aiCoach.js fallback reply');
assert(aiJs.includes('NETWORK_ERROR'), 'aiCoach.js network error handling');

console.log(failures === 0 ? 'AiCoachFallback tests passed ✓' : failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
