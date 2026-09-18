// ============================================================
// RECOVR - 홈 자동 코칭 인사이트 (독립 모듈)
// Gemini 키가 있으면 최근 기록을 AI로 분석하고, 없거나 실패하면
// HomeStatusSummary가 렌더한 로컬 분석을 그대로 유지합니다.
// ============================================================

const HomeCoachInsight = (() => {
  const MODEL = 'gemini-2.5-flash';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const CACHE_KEY = 'recovr_home_ai_insight_v1';
  const LOOKBACK_DAYS = 28;
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const FAILURE_RETRY_MS = 10 * 60 * 1000;
  const MAX_SESSIONS = 20;

  let currentSignature = '';
  let inFlight = null;
  let inFlightSignature = '';
  let failureSignature = '';
  let failureRetryAt = 0;

  function escapeText(value, maxLength) {
    return String(value ?? '').trim().slice(0, maxLength);
  }

  function getRecentWorkouts(workouts, now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    return (workouts || [])
      .filter((workout) => {
        if (!workout?.date || workout.inProgress) return false;
        const date = new Date(`${workout.date}T12:00:00`);
        return !Number.isNaN(date.getTime()) && date >= cutoff && date <= todayEnd;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(-MAX_SESSIONS);
  }

  function summarizeExercise(exercise) {
    if (!exercise?.name) return null;
    if (exercise.mode === 'duration') {
      const seconds = (exercise.durationSets || [])
        .filter((set) => set.completed)
        .reduce((sum, set) => sum + (Number(set.seconds) || 0), 0);
      const minutes = seconds > 0 ? Math.round(seconds / 60) : Number(exercise.durationMin) || 0;
      return `${exercise.name} ${minutes}분`;
    }

    const completed = (exercise.setDetails || []).filter((set) => set.completed);
    const sets = completed.length ? completed : (exercise.setDetails || []);
    if (sets.length) {
      const top = sets.reduce((best, set) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        return weight * reps > best.weight * best.reps ? { weight, reps } : best;
      }, { weight: 0, reps: 0 });
      return `${exercise.name} ${sets.length}세트 최고 ${top.weight}kg×${top.reps}`;
    }
    return `${exercise.name} ${Number(exercise.sets) || 0}세트`;
  }

  function buildRequestContext(ctx) {
    const settings = ctx?.settings || {};
    const recent = getRecentWorkouts(ctx?.workouts || []);
    const recovery = ctx?.recovery || {};
    const activeRecovery = (ctx?.muscleOrder || [])
      .filter((key) => recovery[key]?.lastDate)
      .sort((a, b) => recovery[a].recoveryPct - recovery[b].recoveryPct)
      .map((key) => {
        const label = typeof MUSCLE_LABELS !== 'undefined' ? MUSCLE_LABELS[key]?.name : '';
        return `${label || key} ${recovery[key].recoveryPct}%`;
      })
      .join(', ');

    let recommendation = '';
    try {
      const item = typeof WorkoutRecommendation !== 'undefined'
        ? WorkoutRecommendation.compute(ctx?.workouts || [], settings)
        : null;
      if (item) recommendation = `${item.label || ''}: ${item.reason || ''}`;
    } catch (_) { /* 로컬 추천이 없어도 AI 분석은 계속 */ }

    let advice = [];
    try {
      advice = typeof WorkoutAdvice !== 'undefined'
        ? (WorkoutAdvice.compute(ctx?.workouts || []) || [])
        : [];
    } catch (_) { /* 로컬 조언이 없어도 AI 분석은 계속 */ }

    const sessions = recent.map((workout) => {
      const exercises = (workout.exercises || []).map(summarizeExercise).filter(Boolean).join(', ');
      return `${workout.date} / ${workout.type || '미분류'} / 피로도 ${workout.fatigue || 3} / ${exercises || '운동 항목 없음'}`;
    });

    return [
      `[분석 기간] 최근 ${LOOKBACK_DAYS}일`,
      `[프로필]\n${typeof UserProfile !== 'undefined' ? UserProfile.formatForAI(settings.profile) : '미입력'}`,
      `[현재 회복] 전체 ${ctx?.recoveryPct ?? 100}% / ${activeRecovery || '부위 기록 없음'}`,
      `[기간 내 운동] ${recent.length}회\n${sessions.length ? sessions.join('\n') : '기록 없음'}`,
      `[로컬 추천] ${recommendation || '없음'}`,
      `[로컬 패턴 조언]\n${advice.length ? advice.map((item) => `${item.title}: ${item.message}`).join('\n') : '없음'}`,
    ].join('\n\n');
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeSignature(ctx) {
    return hashString(JSON.stringify({
      profile: ctx?.settings?.profile || {},
      baseRecoveryHours: ctx?.settings?.baseRecoveryHours || 48,
      workouts: getRecentWorkouts(ctx?.workouts || []),
    }));
  }

  function parseResponse(text) {
    const cleaned = String(text || '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);
    const title = escapeText(parsed.title, 60);
    const summary = escapeText(parsed.summary, 280);
    const advice = Array.isArray(parsed.advice)
      ? parsed.advice.map((item) => escapeText(item, 180)).filter(Boolean).slice(0, 4)
      : [];
    if (!title || !summary || !advice.length) throw new Error('INVALID_AI_RESPONSE');
    return { title, summary, advice };
  }

  async function requestInsight(apiKey, context) {
    const prompt = `아래 사용자의 최근 운동 상태와 기록을 분석해 홈 화면용 상태 요약과 운동 조언을 작성하세요.
정확한 기록만 근거로 사용하고, 통증·부상 가능성이 있으면 진단하지 말고 강도를 낮추고 전문가 상담을 권하세요.
한국어로 간결하게 작성하세요. 반드시 JSON만 반환하세요.
형식: {"title":"핵심 상태 한 문장","summary":"기록 근거를 포함한 2~3문장 요약","advice":["실행 조언 1","실행 조언 2","실행 조언 3"]}

${context}`;

    let response;
    try {
      response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 900,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
          },
        }),
      });
    } catch (_) {
      throw new Error('NETWORK_ERROR');
    }

    if (!response.ok) {
      if (response.status === 429) throw new Error('RATE_LIMIT');
      if (response.status === 502 || response.status === 503) throw new Error('SERVICE_UNAVAILABLE');
      if (response.status === 400 || response.status === 403) throw new Error('INVALID_KEY');
      throw new Error(`HTTP_${response.status}`);
    }

    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
    return parseResponse(text);
  }

  function loadCached(signature) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || cached.signature !== signature || !cached.result) return null;
      if (Date.now() - Number(cached.generatedAt || 0) > CACHE_TTL_MS) return null;
      return cached.result;
    } catch (_) {
      return null;
    }
  }

  function saveCached(signature, result) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        signature,
        generatedAt: Date.now(),
        result,
      }));
    } catch (_) { /* 저장 공간 부족 시 현재 화면에는 그대로 표시 */ }
  }

  function setSource(text, state) {
    const source = document.getElementById('hssInsightSource');
    if (!source) return;
    source.textContent = text;
    source.dataset.state = state || 'local';
  }

  function applyResult(result) {
    const title = document.getElementById('hssInsightTitle');
    const summary = document.getElementById('hssInsightSummary');
    const list = document.getElementById('hssInsightList');
    if (!title || !summary || !list) return;

    title.textContent = result.title;
    summary.textContent = result.summary;
    list.innerHTML = '';
    result.advice.forEach((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    });
    setSource(`Gemini AI · 최근 ${LOOKBACK_DAYS}일`, 'ai');
  }

  function render(ctx) {
    const signature = makeSignature(ctx);
    currentSignature = signature;
    const apiKey = String(ctx?.settings?.geminiApiKey || '').trim();
    const recent = getRecentWorkouts(ctx?.workouts || []);

    if (!apiKey || recent.length === 0) {
      setSource(apiKey ? '로컬 분석 · 운동 기록 대기' : '로컬 분석 · AI 키 없음', 'local');
      return Promise.resolve(null);
    }

    const cached = loadCached(signature);
    if (cached) {
      applyResult(cached);
      return Promise.resolve(cached);
    }

    if (failureSignature === signature && Date.now() < failureRetryAt) {
      setSource('로컬 분석 · AI 연결 실패', 'local');
      return Promise.resolve(null);
    }

    setSource('Gemini AI 분석 중…', 'loading');

    if (!inFlight || inFlightSignature !== signature) {
      inFlightSignature = signature;
      inFlight = requestInsight(apiKey, buildRequestContext(ctx))
        .then((result) => {
          saveCached(signature, result);
          return result;
        })
        .finally(() => {
          if (inFlightSignature === signature) {
            inFlight = null;
            inFlightSignature = '';
          }
        });
    }

    return inFlight
      .then((result) => {
        if (currentSignature === signature) applyResult(result);
        return result;
      })
      .catch((error) => {
        failureSignature = signature;
        failureRetryAt = Date.now() + FAILURE_RETRY_MS;
        if (currentSignature === signature) setSource('로컬 분석 · AI 연결 실패', 'local');
        console.warn('[HomeCoachInsight] AI 분석 실패, 로컬 조언 유지:', error);
        return null;
      });
  }

  return {
    render,
    getRecentWorkouts,
    buildRequestContext,
    makeSignature,
    parseResponse,
    LOOKBACK_DAYS,
    CACHE_KEY,
  };
})();
