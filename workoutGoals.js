// ============================================================
// RECOVR - 월별 운동 목표 모듈 (독립 모듈)
// 이번 달 운동 횟수·유산소 시간 목표 설정 및 달성률 표시
// ============================================================

const WorkoutGoals = (() => {
  const DEFAULT_WORKOUT_TARGET = 12;
  const DEFAULT_CARDIO_TARGET = 600;
  const MIN_WORKOUT_TARGET = 1;
  const MAX_WORKOUT_TARGET = 60;
  const MIN_CARDIO_TARGET = 30;
  const MAX_CARDIO_TARGET = 3000;

  function clampWorkoutTarget(val) {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return DEFAULT_WORKOUT_TARGET;
    return Math.max(MIN_WORKOUT_TARGET, Math.min(MAX_WORKOUT_TARGET, n));
  }

  function clampCardioTarget(val) {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return DEFAULT_CARDIO_TARGET;
    return Math.max(MIN_CARDIO_TARGET, Math.min(MAX_CARDIO_TARGET, n));
  }

  function normalizeGoals(raw) {
    const g = raw || {};
    return {
      workoutEnabled: !!g.workoutEnabled,
      workoutTarget: clampWorkoutTarget(g.workoutTarget ?? DEFAULT_WORKOUT_TARGET),
      cardioEnabled: !!g.cardioEnabled,
      cardioTarget: clampCardioTarget(g.cardioTarget ?? DEFAULT_CARDIO_TARGET),
    };
  }

  function loadGoals() {
    if (typeof loadSettings !== 'function') {
      return normalizeGoals(null);
    }
    return normalizeGoals(loadSettings().monthlyGoals);
  }

  function saveGoals(partial) {
    if (typeof loadSettings !== 'function' || typeof saveSettingsToStorage !== 'function') return;
    const settings = loadSettings();
    settings.monthlyGoals = normalizeGoals({ ...settings.monthlyGoals, ...partial });
    saveSettingsToStorage(settings);
  }

  function hasAnyGoal(goals) {
    const g = goals || loadGoals();
    return g.workoutEnabled || g.cardioEnabled;
  }

  function isInMonth(dateStr, refDate = new Date()) {
    if (!dateStr) return false;
    const d = new Date(`${dateStr}T12:00:00`);
    return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
  }

  function getMonthLabel(refDate = new Date()) {
    return `${refDate.getFullYear()}년 ${refDate.getMonth() + 1}월`;
  }

  function getWorkoutCardioMinutes(workout) {
    if (typeof CardioTracker !== 'undefined') {
      return CardioTracker.getWorkoutCardioMinutes(workout);
    }
    if (!workout || workout.type !== 'cardio') return 0;
    return Math.max(0, parseInt(workout.duration, 10) || 0);
  }

  function getMonthlyStats(workouts, refDate = new Date()) {
    const monthWorkouts = (workouts || []).filter((w) => isInMonth(w.date, refDate));
    let cardioMinutes = 0;

    monthWorkouts.forEach((w) => {
      cardioMinutes += getWorkoutCardioMinutes(w);
    });

    const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
    const dayOfMonth = refDate.getDate();
    const monthProgressPct = Math.round((dayOfMonth / daysInMonth) * 100);

    return {
      sessionCount: monthWorkouts.length,
      cardioMinutes,
      monthLabel: getMonthLabel(refDate),
      daysInMonth,
      dayOfMonth,
      monthProgressPct,
    };
  }

  function calcPct(current, target) {
    if (!target || target <= 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  }

  function getProgressColor(pct) {
    if (pct >= 100) return 'var(--green)';
    if (pct >= 70) return 'var(--cyan)';
    if (pct >= 40) return 'var(--yellow)';
    return 'var(--orange)';
  }

  function buildProgressRow({ label, current, target, unit, pct }) {
    const color = getProgressColor(pct);
    return `
      <div class="wg-progress-row">
        <div class="wg-progress-head">
          <span class="wg-progress-label">${label}</span>
          <span class="wg-progress-val" style="color:${color}">${pct}%</span>
        </div>
        <div class="wg-progress-sub">${current} / ${target}${unit}</div>
        <div class="wg-progress-bar">
          <div class="wg-progress-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }

  function renderHomeCard() {
    const container = document.getElementById('workoutGoalsCard');
    if (!container) return;

    const goals = loadGoals();
    if (!hasAnyGoal(goals)) {
      container.innerHTML = `
        <div class="wg-home-card wg-home-card--empty" onclick="switchView('settings')">
          <div class="wg-home-icon">🎯</div>
          <div class="wg-home-body">
            <div class="wg-home-title">이번 달 목표 설정</div>
            <div class="wg-home-sub">운동 횟수·유산소 시간 목표를 정하고 달성률을 확인해보세요</div>
          </div>
          <div class="wg-home-action">›</div>
        </div>`;
      return;
    }

    const workouts = typeof getCompletedWorkouts === 'function'
      ? getCompletedWorkouts()
      : (typeof loadWorkouts === 'function' ? loadWorkouts().filter((w) => !w.inProgress) : []);

    const stats = getMonthlyStats(workouts);
    const rows = [];

    if (goals.workoutEnabled) {
      const pct = calcPct(stats.sessionCount, goals.workoutTarget);
      rows.push(buildProgressRow({
        label: '운동 횟수',
        current: stats.sessionCount,
        target: goals.workoutTarget,
        unit: '회',
        pct,
      }));
    }

    if (goals.cardioEnabled) {
      const pct = calcPct(stats.cardioMinutes, goals.cardioTarget);
      rows.push(buildProgressRow({
        label: '유산소 시간',
        current: stats.cardioMinutes,
        target: goals.cardioTarget,
        unit: '분',
        pct,
      }));
    }

    container.innerHTML = `
      <div class="wg-home-card" onclick="switchView('stats')">
        <div class="wg-home-icon">🎯</div>
        <div class="wg-home-body">
          <div class="wg-home-title">${stats.monthLabel} 목표</div>
          <div class="wg-home-sub">월 ${stats.dayOfMonth}일 · 시간 경과 ${stats.monthProgressPct}%</div>
          ${rows.join('')}
        </div>
      </div>`;
  }

  function fillForm() {
    const goals = loadGoals();
    const workoutEnabled = document.getElementById('goalWorkoutEnabled');
    const workoutTarget = document.getElementById('goalWorkoutTarget');
    const cardioEnabled = document.getElementById('goalCardioEnabled');
    const cardioTarget = document.getElementById('goalCardioTarget');
    const workoutWrap = document.getElementById('goalWorkoutSettings');
    const cardioWrap = document.getElementById('goalCardioSettings');

    if (workoutEnabled) workoutEnabled.checked = goals.workoutEnabled;
    if (workoutTarget) workoutTarget.value = String(goals.workoutTarget);
    if (cardioEnabled) cardioEnabled.checked = goals.cardioEnabled;
    if (cardioTarget) cardioTarget.value = String(goals.cardioTarget);
    if (workoutWrap) workoutWrap.style.display = goals.workoutEnabled ? '' : 'none';
    if (cardioWrap) cardioWrap.style.display = goals.cardioEnabled ? '' : 'none';
  }

  function saveFromForm() {
    const workoutEnabled = document.getElementById('goalWorkoutEnabled');
    const workoutTarget = document.getElementById('goalWorkoutTarget');
    const cardioEnabled = document.getElementById('goalCardioEnabled');
    const cardioTarget = document.getElementById('goalCardioTarget');

    saveGoals({
      workoutEnabled: workoutEnabled ? workoutEnabled.checked : false,
      workoutTarget: workoutTarget ? workoutTarget.value : DEFAULT_WORKOUT_TARGET,
      cardioEnabled: cardioEnabled ? cardioEnabled.checked : false,
      cardioTarget: cardioTarget ? cardioTarget.value : DEFAULT_CARDIO_TARGET,
    });
    fillForm();
    if (typeof renderHome === 'function') renderHome();
  }

  return {
    loadGoals,
    saveGoals,
    hasAnyGoal,
    getMonthlyStats,
    calcPct,
    renderHomeCard,
    fillForm,
    saveFromForm,
    DEFAULT_WORKOUT_TARGET,
    DEFAULT_CARDIO_TARGET,
  };
})();
