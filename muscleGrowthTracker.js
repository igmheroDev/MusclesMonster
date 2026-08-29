// ============================================================
// RECOVR - 근성장/근손실 추적 모듈 (독립 모듈, 추정치 제공)
//
// 기존 calcMuscleRecovery(app.js)는 "세션 후 몇 시간 쉬어야 하는지"를
// 시간 단위로 계산합니다. 이 모듈은 완전히 별개의 지표로,
// "최근 몇 주간 훈련 패턴이 성장 방향인지, 방치로 인해 퇴화(디트레이닝) 중인지"를
// 주(week) 단위로 추정합니다. 두 지표는 목적과 시간축이 달라 서로 독립적으로 계산하며,
// calcMuscleRecovery나 다른 완성 모듈의 코드는 전혀 수정하지 않습니다.
//
// 체성분계/DXA 같은 실측 데이터가 없으므로 "리터럴 근육량(g/kg)"이 아닌
// 훈련 빈도·과부하·미훈련 기간 기반의 "지수(추정치)"로 제공합니다.
// ============================================================

const MuscleGrowthTracker = (() => {
  const LOG_STORAGE_KEY = 'recovr_growth_log_v1'; // 날짜별 세션 요약(칼로리 등) 로그

  // ------------------------------------------------------------
  // 칼로리 소모 추정
  // ------------------------------------------------------------
  // 운동 타입별 MET(대사당량) 참고값 - 저항운동/유산소 일반 기준
  const METS_BY_TYPE = { upper: 5.0, lower: 6.5, full: 6.0, cardio: 7.0 };
  // 체감 피로도(1~5)에 따른 칼로리 보정 배율 (FATIGUE_RECOVERY_SCALE와는 목적이 달라 별도 상수로 관리)
  const FATIGUE_MET_SCALE = { 1: 0.8, 2: 0.9, 3: 1.0, 4: 1.15, 5: 1.3 };
  const DEFAULT_WEIGHT_KG = 65; // 프로필 미입력 시 폴백 체중
  const MIN_ESTIMATED_MINUTES = 15;
  const AVG_MINUTES_PER_EXERCISE = 8; // 세션 시간(duration) 미입력 시 종목 수 기반 추정

  function sumManualCardioCalories(workout) {
    return (workout.exercises || []).reduce((sum, ex) => {
      const c = ex && ex.cardioMetrics ? ex.cardioMetrics.calories : null;
      return sum + (Number.isFinite(c) ? c : 0);
    }, 0);
  }

  function estimateMinutes(workout) {
    if (workout.duration > 0) return workout.duration;
    const exCount = (workout.exercises || []).length;
    return Math.max(MIN_ESTIMATED_MINUTES, exCount * AVG_MINUTES_PER_EXERCISE);
  }

  // 운동 1회 세션의 소모 칼로리 추정(kcal). 유산소는 사용자가 직접 입력한 값을 우선 사용.
  function estimateWorkoutCalories(workout, weightKg) {
    if (!workout) return 0;
    const w = weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
    const manualSum = sumManualCardioCalories(workout);
    if (manualSum > 0 && workout.type === 'cardio') return Math.round(manualSum);

    const met = METS_BY_TYPE[workout.type] || METS_BY_TYPE.full;
    const fatigueScale = FATIGUE_MET_SCALE[workout.fatigue] || 1.0;
    const hours = estimateMinutes(workout) / 60;
    const metCalories = Math.round(met * fatigueScale * w * hours);
    return manualSum > 0 ? Math.max(manualSum, metCalories) : metCalories;
  }

  // ------------------------------------------------------------
  // app.js 전역 헬퍼 재사용 (읽기 전용 참조 — 회복 계산 로직은 건드리지 않음)
  // ------------------------------------------------------------
  function getMuscleOrder() {
    return (typeof MUSCLE_ORDER !== 'undefined') ? MUSCLE_ORDER : [];
  }

  function getExVolumeForMuscle(ex) {
    if (typeof getDurationLoad !== 'function' || typeof getExerciseVolume !== 'function') return 0;
    return ex.mode === 'duration' ? getDurationLoad(ex) : getExerciseVolume(ex);
  }

  function getExMuscles(name) {
    return (typeof getMusclesFromExerciseName === 'function') ? getMusclesFromExerciseName(name) : [];
  }

  function toMidday(dateStr) {
    return new Date(`${dateStr}T12:00:00`);
  }

  // 특정 근육을 자극한 세션들을 [{date, volume}] 형태로, windowDays 이내에서 반환
  function getSessionsForMuscle(workouts, muscleKey, now, windowDays) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - windowDays);
    const sessions = [];

    (workouts || []).forEach((w) => {
      if (!w.date) return;
      const wDate = toMidday(w.date);
      if (wDate < cutoff || wDate > now) return;

      let vol = 0;
      (w.exercises || []).forEach((ex) => {
        if (getExMuscles(ex.name).includes(muscleKey)) vol += getExVolumeForMuscle(ex);
      });
      if (vol > 0) sessions.push({ date: wDate, volume: vol });
    });

    sessions.sort((a, b) => a.date - b.date);
    return sessions;
  }

  function getLastTrainedDate(workouts, muscleKey) {
    let last = null;
    (workouts || []).forEach((w) => {
      if (!w.date) return;
      const hit = (w.exercises || []).some((ex) =>
        getExMuscles(ex.name).includes(muscleKey) && getExVolumeForMuscle(ex) > 0
      );
      if (!hit) return;
      const wDate = toMidday(w.date);
      if (!last || wDate > last) last = wDate;
    });
    return last;
  }

  // ------------------------------------------------------------
  // 근성장 지수 (최근 4주 훈련 빈도 + 과부하 진행도 기반)
  // ------------------------------------------------------------
  const GROWTH_WINDOW_DAYS = 28;
  const GROWTH_SPLIT_DAYS = 14;       // 최근 2주 vs 이전 2주 볼륨 비교
  const IDEAL_SESSIONS_PER_WINDOW = 8; // 부위당 주 2회 x 4주를 "이상적 빈도"로 간주
  const OVERLOAD_MIN = 0.7;
  const OVERLOAD_MAX = 1.3;
  const MAX_GROWTH_PCT = 3; // 4주 기준 이상적 패턴일 때 표시 상한(추정 지수, 실측 아님)

  function computeMuscleGrowth(workouts, muscleKey, now) {
    const sessions = getSessionsForMuscle(workouts, muscleKey, now, GROWTH_WINDOW_DAYS);
    if (sessions.length === 0) return null;

    const splitCutoff = new Date(now);
    splitCutoff.setDate(splitCutoff.getDate() - GROWTH_SPLIT_DAYS);
    const recent = sessions.filter((s) => s.date >= splitCutoff);
    const prior = sessions.filter((s) => s.date < splitCutoff);

    const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x.volume, 0) / arr.length : 0);
    const recentAvg = avg(recent);
    const priorAvg = avg(prior);

    // 이전 구간 데이터가 없으면(=아직 4주가 안 됐거나 신규) 과부하 판단을 보류하고 중립(1.0) 처리
    let overloadFactor = 1.0;
    if (priorAvg > 0 && recentAvg > 0) {
      overloadFactor = Math.max(OVERLOAD_MIN, Math.min(OVERLOAD_MAX, recentAvg / priorAvg));
    }

    const freqFactor = Math.max(0, Math.min(1, sessions.length / IDEAL_SESSIONS_PER_WINDOW));
    const overloadScore = (overloadFactor - OVERLOAD_MIN) / (OVERLOAD_MAX - OVERLOAD_MIN);
    const growthScore = freqFactor * overloadScore;
    const growthPct = Math.round(growthScore * MAX_GROWTH_PCT * 10) / 10;

    return {
      growthPct,
      sessionCount: sessions.length,
      recentAvgVolume: Math.round(recentAvg),
      priorAvgVolume: Math.round(priorAvg),
    };
  }

  // ------------------------------------------------------------
  // 근손실(디트레이닝) 지수 (마지막 훈련 이후 경과일 기반)
  // ------------------------------------------------------------
  const LOSS_THRESHOLD_DAYS = 14; // 2주까지는 측정 가능한 손실 없음으로 간주
  const LOSS_MAX_DAYS = 56;       // 8주 이상 미훈련 시 최대치로 클램프
  const MAX_LOSS_PCT = 8;         // 추정 지수 상한(실측 아님)

  function computeMuscleLoss(workouts, muscleKey, now) {
    const last = getLastTrainedDate(workouts, muscleKey);
    if (!last) return null;

    const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (daysSince <= LOSS_THRESHOLD_DAYS) return { lossPct: 0, daysSince };

    const ratio = (daysSince - LOSS_THRESHOLD_DAYS) / (LOSS_MAX_DAYS - LOSS_THRESHOLD_DAYS);
    const lossPct = Math.round(Math.max(0, Math.min(1, ratio)) * MAX_LOSS_PCT * 10) / 10;
    return { lossPct, daysSince };
  }

  // 전체 부위 종합: { hasData, overallGrowthPct, overallLossPct, perMuscle }
  function compute(workouts, now) {
    const at = now || new Date();
    const muscles = getMuscleOrder();
    const perMuscle = {};
    const growthValues = [];
    const lossValues = [];

    muscles.forEach((m) => {
      const growth = computeMuscleGrowth(workouts, m, at);
      const loss = computeMuscleLoss(workouts, m, at);
      perMuscle[m] = { growth, loss };
      if (growth) growthValues.push(growth.growthPct);
      if (loss) lossValues.push(loss.lossPct);
    });

    const avgOf = (arr) => (arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : 0);

    return {
      hasData: growthValues.length > 0 || lossValues.length > 0,
      overallGrowthPct: avgOf(growthValues),
      overallLossPct: avgOf(lossValues),
      perMuscle,
    };
  }

  // ------------------------------------------------------------
  // 일자별 세션 요약 로그 (그날 운동으로 소모한 칼로리·자극 부위 기록)
  // ------------------------------------------------------------
  function loadLog() {
    try {
      const raw = localStorage.getItem(LOG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveLog(data) {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* 저장 실패는 무시 - 홈 카드는 workouts에서 다시 계산 가능 */ }
  }

  function formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 운동 저장 완료 시 그날의 칼로리·자극 부위를 로그에 기록
  function recordDailySummary(workout, weightKg) {
    if (!workout || !workout.date) return null;
    const calories = estimateWorkoutCalories(workout, weightKg);
    const muscles = getMuscleOrder().filter((m) =>
      (workout.exercises || []).some((ex) => getExMuscles(ex.name).includes(m))
    );

    const log = loadLog();
    log[workout.date] = { calories, muscles, updatedAt: new Date().toISOString() };
    saveLog(log);
    return { calories, muscles };
  }

  function getSummaryForDate(dateStr) {
    const log = loadLog();
    return log[dateStr] || null;
  }

  function getTodaySummary() {
    return getSummaryForDate(formatDateKey(new Date()));
  }

  // ------------------------------------------------------------
  // 홈 카드 렌더
  // ------------------------------------------------------------
  function getGrowthColor(pct) {
    if (pct <= 0) return 'var(--muted)';
    if (pct < 1) return 'var(--yellow)';
    return 'var(--green)';
  }

  function getLossColor(pct) {
    if (pct <= 0) return 'var(--green)';
    if (pct < 3) return 'var(--yellow)';
    if (pct < 6) return 'var(--orange)';
    return 'var(--red)';
  }

  function renderHomeCard() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('muscleGrowthCard');
    if (!container) return;

    let workouts = [];
    try {
      workouts = (typeof loadWorkouts === 'function') ? loadWorkouts() : [];
    } catch (e) {
      workouts = [];
    }

    let result;
    try {
      result = compute(workouts, new Date());
    } catch (e) {
      console.warn('[RECOVR] 근성장/근손실 계산 실패:', e);
      container.innerHTML = '';
      return;
    }

    if (!result.hasData) {
      container.innerHTML = '';
      return;
    }

    const growthPct = result.overallGrowthPct;
    const lossPct = result.overallLossPct;

    container.innerHTML = `
      <div class="section-title"><span>근성장 · 근손실 추적</span></div>
      <div class="mgt-card">
        <div class="mgt-row">
          <div class="mgt-item">
            <div class="mgt-label">📈 근성장 지수</div>
            <div class="mgt-value" style="color:${getGrowthColor(growthPct)}">+${growthPct}%</div>
            <div class="mgt-desc">최근 4주 훈련 빈도·과부하 기준</div>
          </div>
          <div class="mgt-item">
            <div class="mgt-label">📉 근손실 지수</div>
            <div class="mgt-value" style="color:${getLossColor(lossPct)}">-${lossPct}%</div>
            <div class="mgt-desc">장기 미훈련 부위 기준</div>
          </div>
        </div>
        <div class="mgt-hint">체성분 실측이 아닌 훈련 패턴 기반 추정치예요.</div>
      </div>`;
  }

  // ------------------------------------------------------------
  // 운동 저장 완료 훅
  // 기존 saveWorkout()/celebrateFx.js 코드는 전혀 수정하지 않고,
  // celebrateFx.js와 동일한 방식(#saveBtn 클릭 + 모달 닫힘 감지)으로 독립 관찰만 한다.
  // ------------------------------------------------------------
  const TOAST_DELAY_MS = 1700; // "운동 기록 완료" 토스트(celebrateFx)와 겹치지 않도록 지연
  const TOAST_COOLDOWN_MS = 4000;
  let lastToastAt = 0;

  function getLatestWorkout(workouts) {
    const completed = (workouts || []).filter((w) => !w.inProgress && w.date);
    if (completed.length === 0) return null;
    const ts = (w) => new Date(w.updatedAt || w.createdAt || `${w.date}T00:00:00`).getTime();
    return completed.reduce((latest, w) => (ts(w) >= ts(latest) ? w : latest));
  }

  function getProfileWeightKg() {
    try {
      const settings = (typeof loadSettings === 'function') ? loadSettings() : null;
      if (!settings) return 0;
      const profile = (typeof UserProfile !== 'undefined' && UserProfile.normalize)
        ? UserProfile.normalize(settings.profile)
        : settings.profile;
      return (profile && profile.weightKg) || 0;
    } catch (e) {
      return 0;
    }
  }

  function handleWorkoutSaved() {
    let workouts = [];
    try {
      workouts = (typeof loadWorkouts === 'function') ? loadWorkouts() : [];
    } catch (e) {
      return;
    }
    const workout = getLatestWorkout(workouts);
    if (!workout) return;

    const summary = recordDailySummary(workout, getProfileWeightKg());
    if (!summary) return;

    const now = Date.now();
    if (now - lastToastAt < TOAST_COOLDOWN_MS) return;
    lastToastAt = now;

    if (typeof CelebrateFx === 'undefined' || typeof CelebrateFx.showToast !== 'function') return;
    window.setTimeout(() => {
      CelebrateFx.showToast(`오늘 소모 칼로리 약 ${summary.calories}kcal 🔥`);
    }, TOAST_DELAY_MS);
  }

  function onDocumentClick(e) {
    const saveBtn = e.target && e.target.closest && e.target.closest('#saveBtn');
    if (!saveBtn || saveBtn.disabled) return;
    window.setTimeout(() => {
      const overlay = document.getElementById('modalOverlay');
      const closed = !overlay || !overlay.classList.contains('show');
      if (closed) handleWorkoutSaved();
    }, 80);
  }

  function init() {
    if (typeof document === 'undefined') return;
    // 모달 내부(.modal)는 오버레이 클릭-닫기 방지를 위해 onclick="event.stopPropagation()"을
    // 사용하므로, #saveBtn 클릭은 document까지 버블링되지 않는다.
    // 따라서 버블 단계가 아닌 캡처 단계에서 감지한다(다른 모듈 코드는 수정하지 않음).
    document.addEventListener('click', onDocumentClick, true);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init,
    compute,
    estimateWorkoutCalories,
    computeMuscleGrowth,
    computeMuscleLoss,
    recordDailySummary,
    getSummaryForDate,
    getTodaySummary,
    renderHomeCard,
  };
})();
