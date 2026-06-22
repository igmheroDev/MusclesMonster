// ============================================================
// RECOVR - 운동 추천 모듈 (rule-based, 로컬 전용)
// 최근 10일 기록 + 회복도 + 볼륨/빈도를 분석해
// 상체/하체 × 유지/성장 중 하나를 추천합니다.
// ============================================================

const WorkoutRecommendation = (() => {
  const MIN_HISTORY_DAYS = 10;
  const MIN_SESSION_COUNT = 3;
  const LOOKBACK_DAYS = 10;
  const MAX_SUGGESTED_EXERCISES = 7;
  const GROWTH_WEIGHT_BUMP_RATIO = 0.05;
  const GROWTH_WEIGHT_BUMP_MIN_KG = 2.5;

  const UPPER_MUSCLES = ['chest', 'back', 'shoulder', 'biceps', 'triceps'];
  const LOWER_MUSCLES = ['quads', 'hamstrings', 'adductors', 'calves'];

  const TYPE_META = {
    upper_maintain: { label: '상체 유지', icon: '🔄', workoutType: 'upper', mode: 'maintain', accent: 'var(--cyan)' },
    upper_growth:   { label: '상체 성장', icon: '📈', workoutType: 'upper', mode: 'growth', accent: 'var(--cyan)' },
    lower_maintain: { label: '하체 유지', icon: '🔄', workoutType: 'lower', mode: 'maintain', accent: 'var(--orange)' },
    lower_growth:   { label: '하체 성장', icon: '📈', workoutType: 'lower', mode: 'growth', accent: 'var(--orange)' },
  };

  const TYPE_ORDER = ['upper_growth', 'upper_maintain', 'lower_growth', 'lower_maintain'];
  const SELECTED_TYPE_KEY = 'recovr_rec_selected_v1';

  let currentRecommendation = null;

  function loadSelectedTypeId() {
    try {
      const raw = localStorage.getItem(SELECTED_TYPE_KEY);
      return raw && TYPE_META[raw] ? raw : null;
    } catch (e) {
      return null;
    }
  }

  function saveSelectedTypeId(id) {
    if (!TYPE_META[id]) return;
    localStorage.setItem(SELECTED_TYPE_KEY, id);
  }

  function getBestTypeId(scores) {
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }

  function getWorkoutsInLookback(workouts, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return workouts.filter(w => new Date(`${w.date}T12:00:00`) >= cutoff);
  }

  function getHistorySpanDays(workouts) {
    if (workouts.length === 0) return 0;
    const dates = workouts.map(w => new Date(`${w.date}T12:00:00`).getTime());
    const earliest = Math.min(...dates);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.floor((today - earliest) / (1000 * 60 * 60 * 24));
  }

  function hasEnoughHistory(workouts) {
    return getHistorySpanDays(workouts) >= MIN_HISTORY_DAYS && workouts.length >= MIN_SESSION_COUNT;
  }

  function getRegionRecoveryAvg(recovery, muscleKeys) {
    const active = muscleKeys.filter(m => recovery[m]?.lastDate);
    if (active.length === 0) return 100;
    return active.reduce((sum, m) => sum + recovery[m].recoveryPct, 0) / active.length;
  }

  function sessionMatchesRegion(workout, region) {
    if (region === 'upper') return workout.type === 'upper' || workout.type === 'full';
    return workout.type === 'lower' || workout.type === 'full';
  }

  function countRegionSessions(workouts, region) {
    return workouts.filter(w => sessionMatchesRegion(w, region)).length;
  }

  function getRegionVolume(workouts, muscleKeys) {
    let volume = 0;
    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        const muscles = getMusclesFromExerciseName(ex.name);
        if (muscles.some(m => muscleKeys.includes(m))) {
          volume += getExerciseVolume(ex);
        }
      });
    });
    return volume;
  }

  function daysSinceLastRegionSession(workouts, region) {
    let latest = null;
    workouts.forEach(w => {
      if (!sessionMatchesRegion(w, region)) return;
      const d = new Date(`${w.date}T12:00:00`);
      if (!latest || d > latest) latest = d;
    });
    if (!latest) return 99;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.floor((today - latest) / (1000 * 60 * 60 * 24));
  }

  function scoreRecommendations({ upperRec, lowerRec, upperSessions, lowerSessions, upperVol, lowerVol, daysSinceUpper, daysSinceLower }) {
    const scores = {
      upper_growth: 0,
      upper_maintain: 0,
      lower_growth: 0,
      lower_maintain: 0,
    };

    // 상체 성장: 회복 충분 + 하체를 더 많이 함 + 상체 휴식 기간 있음
    if (upperRec >= 88) scores.upper_growth += 28;
    else if (upperRec >= 75) scores.upper_growth += 12;
    if (daysSinceUpper >= 3) scores.upper_growth += 24;
    else if (daysSinceUpper >= 2) scores.upper_growth += 10;
    if (lowerSessions > upperSessions) scores.upper_growth += 18;
    if (lowerVol > upperVol * 1.15) scores.upper_growth += 14;
    if (upperSessions >= 3) scores.upper_growth -= 22;

    // 상체 유지: 최근 상체를 자주/최근에 함 + 회복은 아직 완전하지 않음
    if (upperRec >= 55 && upperRec < 90) scores.upper_maintain += 22;
    if (daysSinceUpper <= 2) scores.upper_maintain += 26;
    if (upperSessions >= 2) scores.upper_maintain += 22;
    if (upperVol >= lowerVol * 0.9) scores.upper_maintain += 12;
    if (upperRec >= 95 && daysSinceUpper >= 4) scores.upper_maintain -= 18;

    // 하체 성장
    if (lowerRec >= 88) scores.lower_growth += 28;
    else if (lowerRec >= 75) scores.lower_growth += 12;
    if (daysSinceLower >= 3) scores.lower_growth += 24;
    else if (daysSinceLower >= 2) scores.lower_growth += 10;
    if (upperSessions > lowerSessions) scores.lower_growth += 18;
    if (upperVol > lowerVol * 1.15) scores.lower_growth += 14;
    if (lowerSessions >= 3) scores.lower_growth -= 22;

    // 하체 유지
    if (lowerRec >= 55 && lowerRec < 90) scores.lower_maintain += 22;
    if (daysSinceLower <= 2) scores.lower_maintain += 26;
    if (lowerSessions >= 2) scores.lower_maintain += 22;
    if (lowerVol >= upperVol * 0.9) scores.lower_maintain += 12;
    if (lowerRec >= 95 && daysSinceLower >= 4) scores.lower_maintain -= 18;

    return scores;
  }

  function countWeekSessions(workouts) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return workouts.filter(w => new Date(`${w.date}T12:00:00`) >= cutoff).length;
  }

  function applyProfileScores(scores, settings, weekSessionCount) {
    if (typeof UserProfile === 'undefined') return scores;
    const profile = UserProfile.normalize(settings?.profile);
    return UserProfile.applyGoalToScores(scores, profile, weekSessionCount);
  }

  function buildReason(id, stats, settings) {
    const meta = TYPE_META[id];
    const regionLabel = meta.workoutType === 'upper' ? '상체' : '하체';
    const recPct = Math.round(meta.workoutType === 'upper' ? stats.upperRec : stats.lowerRec);
    const daysSince = meta.workoutType === 'upper' ? stats.daysSinceUpper : stats.daysSinceLower;
    const sessions = meta.workoutType === 'upper' ? stats.upperSessions : stats.lowerSessions;

    if (meta.mode === 'growth') {
      let reason = `${regionLabel} 회복 ${recPct}% · 마지막 ${regionLabel} 운동 ${daysSince}일 전 · 최근 10일 ${sessions}회 → 점진적 과부하 추천`;
      if (typeof UserProfile !== 'undefined' && settings) {
        const p = UserProfile.normalize(settings.profile);
        if (UserProfile.isComplete(p)) {
          const goalLabel = UserProfile.GOAL_OPTIONS[p.goal]?.label;
          if (goalLabel) reason += ` · 목표: ${goalLabel}`;
        }
      }
      return reason;
    }
    let reason = `${regionLabel} 회복 ${recPct}% · 최근 10일 ${sessions}회 운동 → 평소 루틴 유지 추천`;
    if (typeof UserProfile !== 'undefined' && settings) {
      const p = UserProfile.normalize(settings.profile);
      if (UserProfile.isComplete(p)) {
        const goalLabel = UserProfile.GOAL_OPTIONS[p.goal]?.label;
        if (goalLabel) reason += ` · 목표: ${goalLabel}`;
      }
    }
    return reason;
  }

  function getRepresentativeExercise(workouts, name) {
    for (let i = workouts.length - 1; i >= 0; i--) {
      const found = (workouts[i].exercises || []).find(ex => ex.name === name);
      if (found) return { ...found };
    }
    return { name, weight: '', reps: 10, sets: 3 };
  }

  function bumpWeightForGrowth(weight) {
    const num = Number(weight);
    if (!num || Number.isNaN(num)) return weight;
    const bumped = Math.max(num + GROWTH_WEIGHT_BUMP_MIN_KG, Math.round(num * (1 + GROWTH_WEIGHT_BUMP_RATIO) * 2) / 2);
    return bumped;
  }

  function exerciseToPrefill(exercise, mode) {
    const prefill = {
      name: exercise.name,
      weight: exercise.weight,
      reps: exercise.reps,
      sets: exercise.sets,
      setDetails: exercise.setDetails ? exercise.setDetails.map(s => ({ ...s })) : undefined,
    };

    if (mode !== 'growth') return prefill;

    if (prefill.setDetails?.length) {
      prefill.setDetails = prefill.setDetails.map(s => ({
        ...s,
        weight: bumpWeightForGrowth(s.weight),
        completed: false,
      }));
    } else if (prefill.weight) {
      prefill.weight = bumpWeightForGrowth(prefill.weight);
    }
    return prefill;
  }

  function buildSuggestedExercises(workouts, id) {
    const meta = TYPE_META[id];
    const regionWorkouts = workouts.filter(w => sessionMatchesRegion(w, meta.workoutType));
    const source = regionWorkouts.length > 0 ? regionWorkouts : workouts;

    const freq = new Map();
    source.forEach(w => {
      (w.exercises || []).forEach(ex => {
        if (!ex.name?.trim()) return;
        const key = ex.name.trim();
        freq.set(key, (freq.get(key) || 0) + 1);
      });
    });

    const ranked = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SUGGESTED_EXERCISES)
      .map(([name]) => name);

    return ranked.map(name => exerciseToPrefill(getRepresentativeExercise(source, name), meta.mode));
  }

  function buildRecommendation(workouts, stats, typeId, settings) {
    const meta = TYPE_META[typeId];
    return {
      id: typeId,
      ...meta,
      reason: buildReason(typeId, stats, settings),
      tip: meta.mode === 'growth'
        ? '무게 또는 반복을 소폭 올려보세요 (약 2.5~5%)'
        : '평소와 비슷한 무게·세트로 가볍게 진행하세요',
      exercises: buildSuggestedExercises(workouts, typeId),
      stats,
    };
  }

  function buildStats(workouts, settings) {
    const recovery = calcMuscleRecovery(workouts, settings);
    const recent = getWorkoutsInLookback(workouts, LOOKBACK_DAYS);
    const weekSessionCount = countWeekSessions(workouts);

    const stats = {
      upperRec: getRegionRecoveryAvg(recovery, UPPER_MUSCLES),
      lowerRec: getRegionRecoveryAvg(recovery, LOWER_MUSCLES),
      upperSessions: countRegionSessions(recent, 'upper'),
      lowerSessions: countRegionSessions(recent, 'lower'),
      upperVol: getRegionVolume(recent, UPPER_MUSCLES),
      lowerVol: getRegionVolume(recent, LOWER_MUSCLES),
      daysSinceUpper: daysSinceLastRegionSession(workouts, 'upper'),
      daysSinceLower: daysSinceLastRegionSession(workouts, 'lower'),
      historyDays: getHistorySpanDays(workouts),
      weekSessionCount,
    };

    const baseScores = scoreRecommendations(stats);
    const scores = applyProfileScores(baseScores, settings, weekSessionCount);
    const autoTypeId = getBestTypeId(scores);
    const selectedTypeId = loadSelectedTypeId() || autoTypeId;

    return { stats, scores, autoTypeId, selectedTypeId };
  }

  function compute(workouts, settings) {
    if (!hasEnoughHistory(workouts)) return null;

    const { stats, scores, autoTypeId, selectedTypeId } = buildStats(workouts, settings);

    return {
      ...buildRecommendation(workouts, stats, selectedTypeId, settings),
      scores,
      autoTypeId,
      selectedTypeId,
    };
  }

  function buildTypeSelectOptions(autoTypeId, selectedTypeId) {
    return TYPE_ORDER.map(id => {
      const meta = TYPE_META[id];
      const isAuto = id === autoTypeId;
      const suffix = isAuto ? ' ★ 추천' : '';
      return `<option value="${id}"${id === selectedTypeId ? ' selected' : ''}>${meta.icon} ${meta.label}${suffix}</option>`;
    }).join('');
  }

  function setType(typeId) {
    if (!TYPE_META[typeId]) return;
    saveSelectedTypeId(typeId);
    render();
  }

  function render() {
    const container = document.getElementById('recommendationCard');
    if (!container) return;

    const workouts = loadWorkouts();
    const settings = loadSettings();
    const rec = compute(workouts, settings);
    currentRecommendation = rec;

    if (!rec) {
      const span = getHistorySpanDays(workouts);
      const remain = Math.max(0, MIN_HISTORY_DAYS - span);
      container.innerHTML = `
        <div class="recommend-card recommend-card--pending">
          <div class="rec-icon">🧭</div>
          <div class="rec-body">
            <div class="rec-title">오늘의 추천 준비 중</div>
            <div class="rec-desc">${remain > 0
              ? `기록 ${remain}일 더 쌓이면 상·하체 유지/성장 추천을 알려드려요.`
              : `운동 ${MIN_SESSION_COUNT}회 이상 기록하면 추천이 시작돼요.`}</div>
          </div>
        </div>`;
      return;
    }

    const exercisePreview = rec.exercises.slice(0, 4).map(ex => ex.name).join(' · ');
    const moreCount = Math.max(0, rec.exercises.length - 4);
    const isAutoPick = rec.id === rec.autoTypeId;

    container.innerHTML = `
      <div class="recommend-card" style="border-color:${rec.accent}33">
        <div class="rec-top">
          <div class="rec-select-wrap">
            <label class="rec-select-label" for="recTypeSelect">운동 유형</label>
            <select id="recTypeSelect" class="rec-type-select" onchange="WorkoutRecommendation.setType(this.value)">
              ${buildTypeSelectOptions(rec.autoTypeId, rec.selectedTypeId)}
            </select>
          </div>
          <div class="rec-meta">최근 ${LOOKBACK_DAYS}일 · ${rec.stats.historyDays}일 기록</div>
        </div>
        ${!isAutoPick ? `<div class="rec-auto-hint">기록 분석 추천: ${TYPE_META[rec.autoTypeId].icon} ${TYPE_META[rec.autoTypeId].label}</div>` : ''}
        <div class="rec-reason">${rec.reason}</div>
        <div class="rec-tip">${rec.tip}</div>
        <div class="rec-exercises">${exercisePreview}${moreCount > 0 ? ` 외 ${moreCount}종목` : ''}</div>
        <button class="rec-apply-btn" style="background:linear-gradient(135deg, ${rec.accent}, var(--green))" onclick="WorkoutRecommendation.apply()">
          이 추천으로 운동 시작
        </button>
      </div>`;
  }

  function apply() {
    if (!currentRecommendation) return;
    if (typeof openModalWithPrefill !== 'function') {
      alert('추천 적용 기능을 불러오지 못했어요. 페이지를 새로고침해주세요.');
      return;
    }
    openModalWithPrefill({
      type: currentRecommendation.workoutType,
      exercises: currentRecommendation.exercises,
      title: `추천: ${currentRecommendation.label}`,
    });
  }

  return { compute, render, apply, setType };
})();
