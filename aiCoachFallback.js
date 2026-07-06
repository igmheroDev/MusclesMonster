// ============================================================
// RECOVR - AI 코치 규칙 기반 폴백 모듈 (독립 모듈)
// Gemini API 한도 초과·네트워크 오류 시 로컬 분석 답변 제공
// ============================================================

const AiCoachFallback = (() => {
  const PREFIX = '📋 [규칙 기반 답변]\nAI 한도 초과 또는 연결 문제로 로컬 분석 결과를 드려요.\n\n';
  const LOOKBACK_DAYS = 14;

  function shouldUseFallback(err) {
    const msg = err?.message || String(err);
    if (msg === 'RATE_LIMIT') return true;
    if (msg === 'NETWORK_ERROR') return true;
    if (msg === 'SERVICE_UNAVAILABLE') return true;
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return true;
    return false;
  }

  function detectIntent(message) {
    const m = (message || '').replace(/\s+/g, ' ');
    if (/오늘|뭐.*운동|무엇.*운동|today/i.test(m)) return 'today';
    if (/계획|루틴|이번\s*주|주간|weekly/i.test(m)) return 'weekly';
    if (/푸시|풀|밸런스|균형|상체|하체/i.test(m)) return 'balance';
    if (/회복|쉬|rest|피로/i.test(m)) return 'recovery';
    if (/유산소|cardio|심폐/i.test(m)) return 'cardio';
    return 'general';
  }

  function getWorkouts() {
    if (typeof getCompletedWorkouts === 'function') return getCompletedWorkouts();
    if (typeof loadWorkouts === 'function') return loadWorkouts().filter((w) => !w.inProgress);
    return [];
  }

  function getSettings() {
    return typeof loadSettings === 'function' ? loadSettings() : {};
  }

  function getRecoveryData() {
    if (typeof calcMuscleRecovery !== 'function' || typeof MUSCLE_ORDER === 'undefined') {
      return { overallPct: 100, active: [], recovery: {} };
    }
    const workouts = getWorkouts();
    const settings = getSettings();
    const recovery = calcMuscleRecovery(workouts, settings);
    const active = MUSCLE_ORDER.filter((m) => recovery[m]?.lastDate);
    let overallPct = 100;
    if (active.length > 0) {
      overallPct = Math.round(active.reduce((s, m) => s + recovery[m].recoveryPct, 0) / active.length);
    }
    return { overallPct, active, recovery };
  }

  function muscleName(key) {
    return MUSCLE_LABELS?.[key]?.name || key;
  }

  function getLowRecoveryMuscles(threshold = 70) {
    const { active, recovery } = getRecoveryData();
    return active
      .filter((m) => recovery[m].recoveryPct < threshold)
      .sort((a, b) => recovery[a].recoveryPct - recovery[b].recoveryPct)
      .map((m) => ({ key: m, pct: recovery[m].recoveryPct, name: muscleName(m) }));
  }

  function getReadyMuscles(threshold = 95) {
    const { active, recovery } = getRecoveryData();
    return active
      .filter((m) => recovery[m].recoveryPct >= threshold)
      .map((m) => ({ key: m, pct: recovery[m].recoveryPct, name: muscleName(m) }));
  }

  function getRecommendation() {
    if (typeof WorkoutRecommendation === 'undefined') return null;
    try {
      return WorkoutRecommendation.compute(getWorkouts(), getSettings());
    } catch (e) {
      return null;
    }
  }

  function getAdviceItems() {
    if (typeof WorkoutAdvice === 'undefined') return [];
    try {
      const items = WorkoutAdvice.compute(getWorkouts());
      return items || [];
    } catch (e) {
      return [];
    }
  }

  function formatExerciseList(exercises, max = 5) {
    return (exercises || []).slice(0, max).map((ex) => {
      if (ex.mode === 'duration') return `· ${ex.name} ${ex.durationMin || 0}분`;
      const w = ex.weight ? `${ex.weight}kg` : '';
      const r = ex.reps ? `×${ex.reps}` : '';
      const s = ex.sets ? `${ex.sets}세트` : '';
      return `· ${ex.name} ${[s, w + r].filter(Boolean).join(' ')}`.trim();
    }).join('\n');
  }

  function buildTodayReply() {
    const { overallPct } = getRecoveryData();
    const low = getLowRecoveryMuscles(60);
    const lines = [`전체 회복도 ${overallPct}%예요.`];

    if (low.length >= 3 || overallPct < 50) {
      lines.push('최근 강도가 높아 보여요. 오늘은 가벼운 모빌리티·스트레칭 위주로 쉬어가는 걸 추천해요.');
      lines.push('· 플랭크 3세트 × 30~45초');
      lines.push('· 고양이-소 자세 10회');
      lines.push('· 폼롤러 또는 가벼운 스트레칭 10분');
      return lines.join('\n');
    }

    const rec = getRecommendation();
    if (rec?.label) {
      lines.push(`기록 분석 추천: ${rec.label}`);
      if (rec.reason) lines.push(rec.reason);
      if (rec.exercises?.length) {
        lines.push('\n오늘 제안 루틴:');
        lines.push(formatExerciseList(rec.exercises));
      }
    } else {
      lines.push('운동 기록이 더 쌓이면 맞춤 추천이 정확해져요. 상·하체 번갈아 가벼운 루틴부터 시작해보세요.');
    }

    const advice = getAdviceItems()[0];
    if (advice) lines.push(`\n💡 ${advice.title}: ${advice.message}`);

    return lines.join('\n');
  }

  function buildWeeklyReply() {
    const settings = getSettings();
    const days = settings.profile?.daysPerWeek || 3;
    const rec = getRecommendation();
    const lines = [`주 ${days}일 기준 이번 주 계획 초안이에요.`];

    if (rec?.label) {
      lines.push(`\n현재 추천 유형: ${rec.label}`);
      if (rec.tip) lines.push(rec.tip);
    }

    const split = days <= 2
      ? '· 1일차: 전신 / 2일차: 휴식 또는 유산소'
      : days <= 3
        ? '· 1일차: 상체 / 2일차: 하체 / 3일차: 전신 또는 유산소'
        : '· 1일차: 상체 / 2일차: 하체 / 3일차: 휴식·유산소 / 4일차: 상체 / 5일차: 하체';

    lines.push('\n주간 분할 예시:');
    lines.push(split);
    lines.push('· 세트 사이 휴식 60~90초, 피로도 3 이상이면 다음 날 가볍게');

    getAdviceItems().slice(0, 2).forEach((a) => {
      lines.push(`\n${a.icon} ${a.title}: ${a.message}`);
    });

    return lines.join('\n');
  }

  function buildBalanceReply() {
    const advice = getAdviceItems().filter((a) =>
      /균형|푸시|풀|상체|하체|보강/.test(a.title));
    const lines = ['최근 운동 패턴을 분석했어요.'];

    if (advice.length > 0) {
      advice.forEach((a) => lines.push(`\n${a.icon} ${a.title}\n${a.message}`));
    } else {
      lines.push('\n최근 14일 기록에서 큰 불균형은 보이지 않아요. 지금 페이스를 유지하세요.');
      lines.push('· 푸시(가슴·어깨·삼두)와 풀(등·이두)을 번갈아 넣기');
      lines.push('· 상체·하체 비율 1:1에 가깝게 유지');
    }
    return lines.join('\n');
  }

  function buildRecoveryReply() {
    const { overallPct } = getRecoveryData();
    const low = getLowRecoveryMuscles(95);
    const ready = getReadyMuscles(95);
    const lines = [`전체 회복도 ${overallPct}%예요.`];

    if (low.length === 0) {
      lines.push('대부분 부위가 충분히 회복됐어요. 오늘 운동하기 좋은 상태예요.');
      if (ready.length > 0) {
        lines.push(`\n재운동 가능: ${ready.slice(0, 5).map((m) => `${m.name}(${m.pct}%)`).join(', ')}`);
      }
    } else {
      lines.push('\n아직 회복 중인 부위:');
      low.forEach((m) => lines.push(`· ${m.name}: ${m.pct}%`));
      lines.push('\n위 부위는 가벼운 루틴이거나 휴식을 추천해요.');
    }
    return lines.join('\n');
  }

  function buildCardioReply() {
    const lines = ['유산소 관련 로컬 분석이에요.'];

    if (typeof CardioTracker !== 'undefined') {
      const stats = CardioTracker.getWeeklyStats(getWorkouts());
      lines.push(`\n이번 주 유산소: ${stats.totalMinutes}분 / 목표 ${stats.goalMinutes}분 (${stats.goalPct}%)`);
      if (stats.topMachine) {
        lines.push(`가장 많이 한 기구: ${stats.topMachine.name} ${stats.topMachine.minutes}분`);
      }
      if (stats.goalPct < 100) {
        lines.push(`\nWHO 권장 기준까지 ${stats.goalMinutes - stats.totalMinutes}분 남았어요.`);
        lines.push('· 빠른 걷기 20분, 실내자전거 15분, 또는 계단 10분 추가를 추천해요.');
      }
    } else {
      lines.push('\n주 150분(약 하루 20~30분) 유산소를 목표로 해보세요.');
    }

    const cardioAdvice = getAdviceItems().find((a) => /유산소|cardio/i.test(a.title + a.message));
    if (cardioAdvice) lines.push(`\n💡 ${cardioAdvice.title}: ${cardioAdvice.message}`);

    return lines.join('\n');
  }

  function buildGeneralReply() {
    const { overallPct } = getRecoveryData();
    const rec = getRecommendation();
    const advice = getAdviceItems();
    const lines = [`전체 회복도 ${overallPct}% · 로컬 규칙 엔진 분석 결과예요.`];

    if (rec?.label) {
      lines.push(`\n추천: ${rec.label}`);
      if (rec.reason) lines.push(rec.reason);
    }

    if (advice.length > 0) {
      lines.push('\n패턴 조언:');
      advice.slice(0, 3).forEach((a) => lines.push(`· ${a.title}: ${a.message}`));
    } else {
      lines.push('\n운동 기록이 더 쌓이면 맞춤 조언이 풍부해져요.');
    }

    lines.push('\nAI 연결이 복구되면 더 구체적인 상담을 받을 수 있어요.');
    return lines.join('\n');
  }

  function buildFallbackReply(userMessage) {
    const intent = detectIntent(userMessage);
    let body;

    switch (intent) {
      case 'today': body = buildTodayReply(); break;
      case 'weekly': body = buildWeeklyReply(); break;
      case 'balance': body = buildBalanceReply(); break;
      case 'recovery': body = buildRecoveryReply(); break;
      case 'cardio': body = buildCardioReply(); break;
      default: body = buildGeneralReply();
    }

    return PREFIX + body;
  }

  return {
    shouldUseFallback,
    detectIntent,
    buildFallbackReply,
    PREFIX,
    LOOKBACK_DAYS,
  };
})();
