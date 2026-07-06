// ============================================================
// RECOVR - 유산소 세부 지표 모듈 (독립 모듈)
// 거리(km)·칼로리·평균 심박수 선택 입력 및 주간 집계
// ============================================================

const CardioMetrics = (() => {
  const MAX_DISTANCE_KM = 999;
  const MAX_CALORIES = 9999;
  const MIN_HEART_RATE = 40;
  const MAX_HEART_RATE = 220;

  function clampDistance(val) {
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(MAX_DISTANCE_KM, Math.round(n * 10) / 10);
  }

  function clampCalories(val) {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(MAX_CALORIES, n);
  }

  function clampHeartRate(val) {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < MIN_HEART_RATE) return null;
    return Math.min(MAX_HEART_RATE, n);
  }

  function normalizeMetrics(ex) {
    const raw = ex?.cardioMetrics || ex || {};
    return {
      distanceKm: clampDistance(raw.distanceKm),
      calories: clampCalories(raw.calories),
      avgHeartRate: clampHeartRate(raw.avgHeartRate),
    };
  }

  function hasAny(metrics) {
    const m = metrics || {};
    return !!(m.distanceKm || m.calories || m.avgHeartRate);
  }

  function toStored(metrics) {
    const m = normalizeMetrics(metrics);
    if (!hasAny(m)) return null;
    const out = {};
    if (m.distanceKm) out.distanceKm = m.distanceKm;
    if (m.calories) out.calories = m.calories;
    if (m.avgHeartRate) out.avgHeartRate = m.avgHeartRate;
    return out;
  }

  function isCardioRow(wrap) {
    if (!wrap) return false;
    const name = wrap.querySelector('.ex-name')?.value?.trim() || '';
    const durationMode = wrap.querySelector('.exercise-row')?.classList.contains('duration-mode');
    const typeCardio = typeof selectedType !== 'undefined' && selectedType === 'cardio';

    if (typeCardio && durationMode && name) return true;
    if (typeof CardioTracker !== 'undefined') {
      return CardioTracker.isCardioExercise({ name, mode: durationMode ? 'duration' : undefined });
    }
    return typeCardio && durationMode;
  }

  function ensureFields(wrap) {
    if (!wrap || wrap.querySelector('.cardio-metrics-row')) return;

    const block = document.createElement('div');
    block.className = 'cardio-metrics-row';
    block.style.display = 'none';
    block.innerHTML = `
      <div class="cardio-metrics-label">세부 지표 <span class="cardio-metrics-optional">(선택)</span></div>
      <div class="cardio-metrics-fields">
        <input type="number" class="cm-distance" inputmode="decimal" placeholder="거리 km" min="0" max="${MAX_DISTANCE_KM}" step="0.1" aria-label="거리 km">
        <input type="number" class="cm-calories" inputmode="numeric" placeholder="칼로리" min="0" max="${MAX_CALORIES}" step="1" aria-label="칼로리">
        <input type="number" class="cm-hr" inputmode="numeric" placeholder="심박 bpm" min="${MIN_HEART_RATE}" max="${MAX_HEART_RATE}" step="1" aria-label="평균 심박">
      </div>`;

    const anchor = wrap.querySelector('.duration-total') || wrap.querySelector('.add-set-btn');
    if (anchor) {
      anchor.insertAdjacentElement('afterend', block);
    } else {
      wrap.appendChild(block);
    }

    block.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(false);
      });
      input.addEventListener('change', () => {
        if (typeof saveWorkoutProgress === 'function') saveWorkoutProgress(true);
      });
    });
  }

  function fillFields(wrap, prefill) {
    ensureFields(wrap);
    const metrics = normalizeMetrics(prefill);
    const dist = wrap.querySelector('.cm-distance');
    const cal = wrap.querySelector('.cm-calories');
    const hr = wrap.querySelector('.cm-hr');
    if (dist) dist.value = metrics.distanceKm ?? '';
    if (cal) cal.value = metrics.calories ?? '';
    if (hr) hr.value = metrics.avgHeartRate ?? '';
    updateVisibility(wrap);
  }

  function updateVisibility(wrap) {
    ensureFields(wrap);
    const block = wrap.querySelector('.cardio-metrics-row');
    if (!block) return;
    block.style.display = isCardioRow(wrap) ? '' : 'none';
  }

  function readFromWrap(wrap) {
    if (!wrap) return null;
    return toStored({
      distanceKm: wrap.querySelector('.cm-distance')?.value,
      calories: wrap.querySelector('.cm-calories')?.value,
      avgHeartRate: wrap.querySelector('.cm-hr')?.value,
    });
  }

  function formatSummary(ex) {
    const m = normalizeMetrics(ex);
    const parts = [];
    if (m.distanceKm) parts.push(`${m.distanceKm}km`);
    if (m.calories) parts.push(`${m.calories}kcal`);
    if (m.avgHeartRate) parts.push(`심박 ${m.avgHeartRate}`);
    return parts.join(' · ');
  }

  function getCardioExercises(workouts) {
    const list = [];
    (workouts || []).forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        if (typeof CardioTracker !== 'undefined' && CardioTracker.isCardioExercise(ex)) {
          list.push({ workout: w, exercise: ex });
        } else if (w.type === 'cardio' && ex.mode === 'duration') {
          list.push({ workout: w, exercise: ex });
        }
      });
    });
    return list;
  }

  function aggregatePeriod(workouts, days = 7) {
    let cutoff = null;
    if (days > 0) {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);
    }

    let distanceKm = 0;
    let calories = 0;
    let hrSum = 0;
    let hrCount = 0;
    let metricSessions = 0;

    getCardioExercises(workouts).forEach(({ workout, exercise }) => {
      if (cutoff && new Date(`${workout.date}T12:00:00`) < cutoff) return;
      const m = normalizeMetrics(exercise);
      if (!hasAny(m)) return;

      metricSessions += 1;
      if (m.distanceKm) distanceKm += m.distanceKm;
      if (m.calories) calories += m.calories;
      if (m.avgHeartRate) {
        hrSum += m.avgHeartRate;
        hrCount += 1;
      }
    });

    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      calories,
      avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
      metricSessions,
      hrCount,
    };
  }

  function onRowAdded(wrap, prefill) {
    if (!wrap) return;
    fillFields(wrap, prefill);
  }

  function refreshAllRows() {
    document.querySelectorAll('#exerciseRows .exercise-row-wrap').forEach(updateVisibility);
  }

  function renderHomeHint() {
    const container = document.getElementById('cardioMetricsHome');
    if (!container) return;

    const workouts = typeof getCompletedWorkouts === 'function'
      ? getCompletedWorkouts()
      : [];
    const agg = aggregatePeriod(workouts, 7);

    if (agg.metricSessions === 0) {
      container.innerHTML = '';
      return;
    }

    const parts = [];
    if (agg.distanceKm > 0) parts.push(`거리 ${agg.distanceKm}km`);
    if (agg.calories > 0) parts.push(`칼로리 ${agg.calories.toLocaleString()}kcal`);
    if (agg.avgHeartRate) parts.push(`평균 심박 ${agg.avgHeartRate}bpm`);

    container.innerHTML = `
      <div class="cardio-metrics-hint">이번 주 세부 지표 · ${parts.join(' · ')}</div>`;
  }

  function renderStatsCard(workouts) {
    const container = document.getElementById('cardioMetricsStats');
    if (!container) return;

    const agg = aggregatePeriod(workouts, 7);
    if (agg.metricSessions === 0) {
      container.innerHTML = `
        <div class="stat-card" style="padding:14px 16px">
          <div style="font-size:12px;color:var(--muted);line-height:1.6">
            유산소 기록 시 거리·칼로리·심박을 입력하면<br>주간 합계가 여기에 표시돼요.
          </div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">주간 거리</div>
          <div class="stat-val" style="color:var(--cardio)">${agg.distanceKm || 0}</div>
          <div class="stat-sub">km</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">주간 칼로리</div>
          <div class="stat-val" style="color:var(--cardio)">${agg.calories.toLocaleString()}</div>
          <div class="stat-sub">kcal</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">평균 심박</div>
          <div class="stat-val" style="color:var(--cardio)">${agg.avgHeartRate ?? '—'}</div>
          <div class="stat-sub">bpm · ${agg.hrCount}회</div>
        </div>
      </div>`;
  }

  function init() {
    const container = document.getElementById('exerciseRows');
    if (container) {
      container.addEventListener('input', (e) => {
        if (e.target.matches('.ex-name')) {
          const wrap = e.target.closest('.exercise-row-wrap');
          if (wrap) updateVisibility(wrap);
        }
      });
    }
  }

  return {
    init,
    onRowAdded,
    refreshAllRows,
    updateVisibility,
    readFromWrap,
    normalizeMetrics,
    formatSummary,
    aggregatePeriod,
    renderHomeHint,
    renderStatsCard,
    hasAny,
    toStored,
  };
})();
