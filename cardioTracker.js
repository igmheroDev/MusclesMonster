// ============================================================
// RECOVR - 유산소(심폐지구력) 추적 모듈 (독립 모듈)
// 천국의계단, 로잉머신 등 duration 기반 유산소 운동 측정·통계
// ============================================================

const CardioTracker = (() => {
  const WEEKLY_GOAL_MINUTES = 150;
  const LOOKBACK_DAYS = 7;

  const PRESETS = [
    { name: '천국의 계단', icon: '🪜', defaultMin: 20 },
    { name: '로잉머신', icon: '🚣', defaultMin: 15 },
    { name: '트레드밀 러닝', icon: '🏃', defaultMin: 30 },
    { name: '실내자전거', icon: '🚴', defaultMin: 20 },
    { name: '일립티컬', icon: '⭕', defaultMin: 20 },
    { name: '스텝퍼', icon: '🦶', defaultMin: 15 },
    { name: '수영', icon: '🏊', defaultMin: 30 },
    { name: '줄넘기', icon: '🪢', defaultMin: 10 },
  ];

  const QUICK_MINUTES = [10, 15, 20, 30, 45];

  function isCardioExercise(ex) {
    if (!ex?.name) return false;
    if (ex.mode === 'duration') {
      const tags = typeof getActivityTagsFromExerciseName === 'function'
        ? getActivityTagsFromExerciseName(ex.name)
        : [];
      if (tags.includes('cardio')) return true;
    }
    return typeof getActivityTagsFromExerciseName === 'function'
      && getActivityTagsFromExerciseName(ex.name).includes('cardio');
  }

  function isCardioWorkout(workout) {
    if (!workout) return false;
    if (workout.type === 'cardio') return true;
    return (workout.exercises || []).some(isCardioExercise);
  }

  function getExerciseMinutes(ex) {
    if (!ex) return 0;
    if (typeof DurationTimer !== 'undefined') {
      const sets = DurationTimer.normalizeSets(ex);
      if (sets.length > 0) return DurationTimer.totalMinutes(sets);
    }
    return Math.max(0, parseInt(ex.durationMin, 10) || 0);
  }

  function getWorkoutCardioMinutes(workout) {
    if (!workout) return 0;
    if (workout.type === 'cardio') {
      const fromExercises = (workout.exercises || []).reduce((sum, ex) => sum + getExerciseMinutes(ex), 0);
      if (fromExercises > 0) return fromExercises;
      return Math.max(0, parseInt(workout.duration, 10) || 0);
    }
    return (workout.exercises || [])
      .filter(isCardioExercise)
      .reduce((sum, ex) => sum + getExerciseMinutes(ex), 0);
  }

  function getWorkoutsInRange(workouts, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return workouts.filter(w => new Date(`${w.date}T12:00:00`) >= cutoff);
  }

  function getWeeklyStats(workouts, days = LOOKBACK_DAYS) {
    const recent = getWorkoutsInRange(workouts, days);
    let totalMinutes = 0;
    let sessionCount = 0;
    const byMachine = {};

    recent.forEach(w => {
      const cardioMin = getWorkoutCardioMinutes(w);
      if (cardioMin <= 0 && w.type !== 'cardio') return;

      if (w.type === 'cardio' || cardioMin > 0) {
        sessionCount++;
        totalMinutes += cardioMin > 0 ? cardioMin : (parseInt(w.duration, 10) || 0);
      }

      (w.exercises || []).forEach(ex => {
        if (!isCardioExercise(ex)) return;
        const min = getExerciseMinutes(ex);
        if (min <= 0) return;
        byMachine[ex.name] = (byMachine[ex.name] || 0) + min;
      });
    });

    const topMachine = Object.entries(byMachine).sort((a, b) => b[1] - a[1])[0];

    return {
      totalMinutes,
      sessionCount,
      goalMinutes: WEEKLY_GOAL_MINUTES,
      goalPct: Math.min(100, Math.round((totalMinutes / WEEKLY_GOAL_MINUTES) * 100)),
      byMachine,
      topMachine: topMachine ? { name: topMachine[0], minutes: topMachine[1] } : null,
      days,
    };
  }

  function getCardioTrend(workouts, limit = 8) {
    const sorted = [...workouts]
      .filter(w => isCardioWorkout(w))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-limit);

    return sorted.map(w => ({
      date: w.date,
      minutes: getWorkoutCardioMinutes(w) || parseInt(w.duration, 10) || 0,
      type: w.type,
    }));
  }

  function formatMinutes(min) {
    if (min < 60) return `${min}분`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  }

  function renderPresetButtons() {
    const grid = document.getElementById('cardioPresetGrid');
    if (!grid) return;

    grid.innerHTML = PRESETS.map(p => `
      <button type="button" class="cardio-preset-btn" onclick="CardioTracker.addPreset('${p.name.replace(/'/g, "\\'")}', ${p.defaultMin})">
        <span class="cardio-preset-icon">${p.icon}</span>
        <span class="cardio-preset-name">${p.name}</span>
        <span class="cardio-preset-min">${p.defaultMin}분</span>
      </button>
    `).join('');
  }

  function togglePresetArea(show) {
    const area = document.getElementById('cardioPresetArea');
    if (area) area.style.display = show ? '' : 'none';
  }

  function addPreset(name, defaultMin) {
    if (typeof addExerciseRow !== 'function') return;
    addExerciseRow({
      name,
      mode: 'duration',
      durationSets: [{ seconds: defaultMin * 60, completed: true }],
    });
    if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(true);
  }

  function applyQuickMinutes(minutes) {
    const wraps = document.querySelectorAll('#exerciseRows .exercise-row-wrap');
    const lastWrap = wraps[wraps.length - 1];
    if (!lastWrap) {
      addPreset('유산소', minutes);
      return;
    }
    const row = lastWrap.querySelector('.exercise-row');
    if (!row?.classList.contains('duration-mode') && typeof setRowMode === 'function') {
      setRowMode(lastWrap, true);
    }
    if (typeof DurationTimer !== 'undefined') {
      DurationTimer.populateWrap(lastWrap, {
        mode: 'duration',
        durationSets: [{ seconds: minutes * 60, completed: true }],
      });
    }
    if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(true);
  }

  function applyCustomMinutes() {
    const input = document.getElementById('cardioCustomMin');
    const minutes = parseInt(input?.value, 10);
    if (!minutes || minutes < 1) {
      alert('운동 시간(분)을 입력해 주세요.');
      input?.focus();
      return;
    }
    applyQuickMinutes(minutes);
    if (input) input.value = '';
  }

  function renderHomeCard() {
    const container = document.getElementById('cardioHomeCard');
    if (!container) return;

    const workouts = typeof getCompletedWorkouts === 'function'
      ? getCompletedWorkouts()
      : (typeof loadWorkouts === 'function' ? loadWorkouts() : []);

    const stats = getWeeklyStats(workouts);

    if (stats.sessionCount === 0) {
      container.innerHTML = `
        <div class="cardio-home-card cardio-home-card--empty" onclick="openCardioModal()">
          <div class="cardio-home-icon">🏃</div>
          <div class="cardio-home-body">
            <div class="cardio-home-title">유산소 기록하기</div>
            <div class="cardio-home-sub">천국의계단, 로잉머신 등 심폐지구력 운동을 추적해보세요</div>
          </div>
          <div class="cardio-home-action">+</div>
        </div>`;
      return;
    }

    const barColor = stats.goalPct >= 100 ? 'var(--green)' : stats.goalPct >= 50 ? 'var(--cardio)' : 'var(--yellow)';
    const topLabel = stats.topMachine
      ? `가장 많이: ${stats.topMachine.name} ${stats.topMachine.minutes}분`
      : `이번 주 ${stats.sessionCount}회`;

    container.innerHTML = `
      <div class="cardio-home-card" onclick="switchView('stats')">
        <div class="cardio-home-icon">🏃</div>
        <div class="cardio-home-body">
          <div class="cardio-home-title">이번 주 유산소 ${formatMinutes(stats.totalMinutes)}</div>
          <div class="cardio-home-sub">${topLabel} · 주간 목표 ${stats.goalMinutes}분</div>
          <div class="cardio-progress-bar">
            <div class="cardio-progress-fill" style="width:${stats.goalPct}%;background:${barColor}"></div>
          </div>
        </div>
        <div class="cardio-home-pct">${stats.goalPct}%</div>
      </div>`;
  }

  function renderTrendChart(workouts) {
    const container = document.getElementById('cardioTrendChart');
    if (!container) return;

    const trend = getCardioTrend(workouts);
    if (trend.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px 0">유산소 기록이 쌓이면<br>시간 추세 그래프가 표시돼요.</div>`;
      return;
    }

    const maxMin = Math.max(...trend.map(t => t.minutes), 1);
    let html = '<div style="display:flex;align-items:flex-end;gap:8px;height:120px">';
    trend.forEach(t => {
      const h = Math.max(4, Math.round((t.minutes / maxMin) * 100));
      const d = new Date(t.date + 'T12:00:00');
      html += `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
          <div style="font-size:9px;color:var(--muted)">${t.minutes}분</div>
          <div style="width:100%;height:${h}%;background:var(--cardio);border-radius:4px 4px 0 0;min-height:4px"></div>
          <div style="font-size:9px;color:var(--muted)">${d.getMonth() + 1}/${d.getDate()}</div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function renderMachineBreakdown(workouts) {
    const container = document.getElementById('cardioMachineList');
    if (!container) return;

    const stats = getWeeklyStats(workouts);
    const entries = Object.entries(stats.byMachine).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:16px"><div class="ee-body">이번 주 유산소 기록이 없어요.</div></div>`;
      return;
    }

    let html = '<div class="muscle-card" style="padding:14px 15px">';
    entries.forEach(([name, min]) => {
      const preset = PRESETS.find(p => p.name === name);
      const icon = preset?.icon || '🏃';
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:12.5px">${icon} ${name}</span>
          <span style="font-size:12px;font-weight:700;color:var(--cardio)">${min}분</span>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  return {
    WEEKLY_GOAL_MINUTES,
    PRESETS,
    QUICK_MINUTES,
    isCardioExercise,
    isCardioWorkout,
    getExerciseMinutes,
    getWorkoutCardioMinutes,
    getWeeklyStats,
    getCardioTrend,
    formatMinutes,
    renderPresetButtons,
    togglePresetArea,
    addPreset,
    applyQuickMinutes,
    applyCustomMinutes,
    renderHomeCard,
    renderTrendChart,
    renderMachineBreakdown,
  };
})();

function openCardioModal() {
  if (typeof openModal !== 'function') return;
  openModal();
  selectType('cardio');
}
