// ============================================================
// RECOVR - 운동 추천 모듈 (rule-based, 로컬 전용)
// 최근 10일 기록 + 회복도 + 볼륨/빈도 + 프로필 상태를 분석해
// 근력·체형·재활·유산소 등 다양한 유형을 추천합니다.
// ============================================================

const WorkoutRecommendation = (() => {
  const MIN_HISTORY_DAYS = 10;
  const MIN_SESSION_COUNT = 3;
  const LOOKBACK_DAYS = 10;
  const MAX_SUGGESTED_EXERCISES = 7;
  const GROWTH_WEIGHT_BUMP_RATIO = 0.05;
  const GROWTH_WEIGHT_BUMP_MIN_KG = 2.5;
  const WEEKLY_CARDIO_GOAL_MINUTES = 150;

  const UPPER_MUSCLES = WorkoutUtils.UPPER_MUSCLES;
  const LOWER_MUSCLES = WorkoutUtils.LOWER_MUSCLES;

  const TYPE_META = {
    upper_maintain:   { label: '상체 유지',       icon: '🔄', workoutType: 'upper',  mode: 'maintain',   accent: 'var(--cyan)',   category: 'strength' },
    upper_growth:     { label: '상체 성장',       icon: '📈', workoutType: 'upper',  mode: 'growth',     accent: 'var(--cyan)',   category: 'strength' },
    lower_maintain:   { label: '하체 유지',       icon: '🔄', workoutType: 'lower',  mode: 'maintain',   accent: 'var(--orange)', category: 'strength' },
    lower_growth:     { label: '하체 성장',       icon: '📈', workoutType: 'lower',  mode: 'growth',     accent: 'var(--orange)', category: 'strength' },
    full_maintain:    { label: '전신 유지',       icon: '🔥', workoutType: 'full',   mode: 'maintain',   accent: 'var(--green)',  category: 'strength' },
    fat_loss:         { label: '체중감소',        icon: '🔥', workoutType: 'full',   mode: 'fat_loss',   accent: 'var(--cardio)', category: 'cardio' },
    functional_cardio:{ label: '기능성 유산소',   icon: '🏃', workoutType: 'cardio', mode: 'cardio',     accent: 'var(--cardio)', category: 'cardio' },
    cervical_rehab:   { label: '목디스크 재활',   icon: '🧣', workoutType: 'full',   mode: 'rehab',      accent: 'var(--cyan)',   category: 'rehab' },
    lumbar_rehab:     { label: '허리 재활',       icon: '🧘', workoutType: 'lower',  mode: 'rehab',      accent: 'var(--orange)', category: 'rehab' },
    rehab_general:    { label: '재활·회복',       icon: '🩹', workoutType: 'full',   mode: 'rehab',      accent: 'var(--green)',  category: 'rehab' },
    mobility:         { label: '가동성·스트레칭', icon: '🤸', workoutType: 'full',   mode: 'mobility',   accent: 'var(--green)',  category: 'wellness' },
    core_stability:   { label: '코어 안정화',     icon: '🎯', workoutType: 'full',   mode: 'rehab',      accent: 'var(--orange)', category: 'rehab' },
  };

  const TYPE_GROUPS = [
    { label: '근력 · 상·하체', ids: ['upper_growth', 'upper_maintain', 'lower_growth', 'lower_maintain', 'full_maintain'] },
    { label: '체형 · 유산소', ids: ['fat_loss', 'functional_cardio'] },
    { label: '재활 · 회복', ids: ['cervical_rehab', 'lumbar_rehab', 'rehab_general', 'core_stability', 'mobility'] },
  ];

  const TYPE_ORDER = TYPE_GROUPS.flatMap(g => g.ids);
  const SELECTED_TYPE_KEY = 'recovr_rec_selected_v1';

  const EXERCISE_PRESETS = {
    fat_loss: [
      { name: '스쿼트', reps: 15, sets: 3, weight: '' },
      { name: '글루트 브릿지', reps: 15, sets: 3, weight: '' },
      { name: '벽 푸시업', reps: 12, sets: 3, weight: '' },
      { name: '제자리 걷기', mode: 'duration', durationMin: 5 },
      { name: '스텝 터치', reps: 20, sets: 3, weight: '' },
      { name: '월싯', mode: 'duration', durationMin: 1 },
    ],
    functional_cardio: [
      { name: '제자리 걷기', mode: 'duration', durationMin: 5 },
      { name: '스텝 터치', reps: 30, sets: 2, weight: '' },
      { name: '버피', reps: 8, sets: 3, weight: '' },
      { name: '마운틴 클라이머', mode: 'duration', durationMin: 1 },
      { name: '점프 스쿼트', reps: 10, sets: 3, weight: '' },
      { name: '로잉머신', mode: 'duration', durationMin: 15 },
    ],
    cervical_rehab: [
      { name: '턱 당기기', reps: 10, sets: 2, weight: '' },
      { name: '견갑 조이기', reps: 12, sets: 2, weight: '' },
      { name: '벽 슬라이드', reps: 10, sets: 2, weight: '' },
      { name: '어깨 돌리기', reps: 10, sets: 2, weight: '' },
      { name: '가슴 열기 스트레칭', mode: 'duration', durationMin: 1 },
      { name: '복식호흡', mode: 'duration', durationMin: 2 },
    ],
    lumbar_rehab: [
      { name: '골반 기울이기', reps: 10, sets: 2, weight: '' },
      { name: '버드독', reps: 8, sets: 2, weight: '' },
      { name: '캣카우', reps: 8, sets: 2, weight: '' },
      { name: '데드버그', reps: 10, sets: 2, weight: '' },
      { name: '글루트 브릿지', reps: 12, sets: 2, weight: '' },
      { name: '힐 슬라이드', reps: 10, sets: 2, weight: '' },
    ],
    rehab_general: [
      { name: '가볍게 걷기', mode: 'duration', durationMin: 10 },
      { name: '의자 앉았다 일어나기', reps: 10, sets: 2, weight: '' },
      { name: '벽 푸시업', reps: 10, sets: 2, weight: '' },
      { name: '글루트 브릿지', reps: 12, sets: 2, weight: '' },
      { name: '카프레이즈', reps: 15, sets: 2, weight: '' },
      { name: '복식호흡', mode: 'duration', durationMin: 2 },
    ],
    mobility: [
      { name: '캣카우', reps: 8, sets: 2, weight: '' },
      { name: '가슴 열기 스트레칭', mode: 'duration', durationMin: 1 },
      { name: '어깨 돌리기', reps: 10, sets: 2, weight: '' },
      { name: '힙 서클', reps: 10, sets: 2, weight: '' },
      { name: '햄스트링 스트레칭', mode: 'duration', durationMin: 1 },
      { name: '종아리 스트레칭', mode: 'duration', durationMin: 1 },
    ],
    core_stability: [
      { name: '데드버그', reps: 10, sets: 3, weight: '' },
      { name: '버드독', reps: 8, sets: 3, weight: '' },
      { name: '플랭크', mode: 'duration', durationMin: 1 },
      { name: '사이드 플랭크', mode: 'duration', durationMin: 1 },
      { name: '골반 기울이기', reps: 12, sets: 2, weight: '' },
      { name: '글루트 브릿지', reps: 15, sets: 2, weight: '' },
    ],
    full_maintain: [
      { name: '스쿼트', reps: 10, sets: 3, weight: '' },
      { name: '벤치 프레스', reps: 10, sets: 3, weight: '' },
      { name: '랫풀다운', reps: 10, sets: 3, weight: '' },
      { name: '레그 프레스', reps: 12, sets: 3, weight: '' },
      { name: '숄더 프레스', reps: 10, sets: 3, weight: '' },
    ],
  };

  const TIPS = {
    growth: '무게 또는 반복을 소폭 올려보세요 (약 2.5~5%)',
    maintain: '평소와 비슷한 무게·세트로 가볍게 진행하세요',
    fat_loss: '세트 사이 휴식을 짧게 유지하고, 통증 없는 범위에서 진행하세요',
    cardio: '호흡이 약간 빨라질 정도의 중강도로 20~30분 목표로 해보세요',
    rehab: '통증이 없는 범위에서 천천히, 자세에 집중하세요. 불편하면 즉시 중단하세요',
    mobility: '호흡을 길게 유지하며 가동 범위를 서서히 넓혀보세요',
  };

  let currentRecommendation = null;

  function initScoreMap() {
    const scores = {};
    TYPE_ORDER.forEach(id => { scores[id] = 0; });
    return scores;
  }

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
    if (region === 'lower') return workout.type === 'lower' || workout.type === 'full';
    if (region === 'cardio') {
      if (workout.type === 'cardio') return true;
      if (typeof CardioTracker !== 'undefined' && CardioTracker.isCardioWorkout(workout)) return true;
      return false;
    }
    return workout.type === 'full';
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

  function getCardioMinutes(workouts) {
    let total = 0;
    workouts.forEach(w => {
      if (typeof CardioTracker !== 'undefined') {
        total += CardioTracker.getWorkoutCardioMinutes(w);
      } else if (w.type === 'cardio') {
        total += parseInt(w.duration, 10) || 0;
      }
    });
    return total;
  }

  function detectEffectiveCondition(profile) {
    const p = profile && typeof profile === 'object' ? profile : {};
    if (p.condition && p.condition !== 'none') return p.condition;

    const memo = (p.injuryNotes || '').toLowerCase();
    if (/목|경추|거북목|일자목|cervical|neck/.test(memo)) return 'cervical_disc';
    if (/허리|요추|좌골|디스크|협착|lumbar|back|sciatica/.test(memo)) return 'lumbar_disc';
    if (p.goal === 'rehab') return 'rehab_general';
    if (p.goal === 'fat_loss') return 'fat_loss';
    return 'none';
  }

  function scoreStrengthRecommendations(stats) {
    const scores = initScoreMap();
    const {
      upperRec, lowerRec, upperSessions, lowerSessions,
      upperVol, lowerVol, daysSinceUpper, daysSinceLower,
    } = stats;

    if (upperRec >= 88) scores.upper_growth += 28;
    else if (upperRec >= 75) scores.upper_growth += 12;
    if (daysSinceUpper >= 3) scores.upper_growth += 24;
    else if (daysSinceUpper >= 2) scores.upper_growth += 10;
    if (lowerSessions > upperSessions) scores.upper_growth += 18;
    if (lowerVol > upperVol * 1.15) scores.upper_growth += 14;
    if (upperSessions >= 3) scores.upper_growth -= 22;

    if (upperRec >= 55 && upperRec < 90) scores.upper_maintain += 22;
    if (daysSinceUpper <= 2) scores.upper_maintain += 26;
    if (upperSessions >= 2) scores.upper_maintain += 22;
    if (upperVol >= lowerVol * 0.9) scores.upper_maintain += 12;
    if (upperRec >= 95 && daysSinceUpper >= 4) scores.upper_maintain -= 18;

    if (lowerRec >= 88) scores.lower_growth += 28;
    else if (lowerRec >= 75) scores.lower_growth += 12;
    if (daysSinceLower >= 3) scores.lower_growth += 24;
    else if (daysSinceLower >= 2) scores.lower_growth += 10;
    if (upperSessions > lowerSessions) scores.lower_growth += 18;
    if (upperVol > lowerVol * 1.15) scores.lower_growth += 14;
    if (lowerSessions >= 3) scores.lower_growth -= 22;

    if (lowerRec >= 55 && lowerRec < 90) scores.lower_maintain += 22;
    if (daysSinceLower <= 2) scores.lower_maintain += 26;
    if (lowerSessions >= 2) scores.lower_maintain += 22;
    if (lowerVol >= upperVol * 0.9) scores.lower_maintain += 12;
    if (lowerRec >= 95 && daysSinceLower >= 4) scores.lower_maintain -= 18;

    const sessionDiff = Math.abs(upperSessions - lowerSessions);
    if (sessionDiff <= 1 && upperSessions >= 1 && lowerSessions >= 1) {
      scores.full_maintain += 22;
    }
    if (upperSessions >= 2 && lowerSessions >= 2) scores.full_maintain += 14;

    return scores;
  }

  function scoreExtendedRecommendations(scores, stats, settings) {
    const next = { ...scores };
    const profile = typeof UserProfile !== 'undefined'
      ? UserProfile.normalize(settings?.profile)
      : {};
    const condition = detectEffectiveCondition(profile);
    const bmi = typeof UserProfile !== 'undefined'
      ? UserProfile.calcBmi(profile.heightCm, profile.weightKg)
      : null;
    const goal = profile.goal || '';
    const {
      cardioSessions, cardioMinutes, weekSessionCount,
      upperSessions, lowerSessions, avgRecovery,
    } = stats;

    const cardioGoalHalf = WEEKLY_CARDIO_GOAL_MINUTES * 0.5;

    if (goal === 'fat_loss' || condition === 'fat_loss') {
      next.fat_loss += 38;
    }
    if (bmi != null && bmi >= 25) next.fat_loss += 16;
    if (bmi != null && bmi >= 30) next.fat_loss += 10;
    if (cardioMinutes < cardioGoalHalf) next.fat_loss += 14;
    if (weekSessionCount >= 3 && cardioSessions === 0) next.fat_loss += 12;

    if (cardioSessions === 0) next.functional_cardio += 32;
    else if (cardioSessions === 1) next.functional_cardio += 18;
    if (cardioMinutes < cardioGoalHalf) next.functional_cardio += 22;
    if (goal === 'fat_loss') next.functional_cardio += 14;
    if (upperSessions + lowerSessions >= 3 && cardioSessions === 0) next.functional_cardio += 16;

    if (condition === 'cervical_disc') {
      next.cervical_rehab += 60;
      next.functional_cardio -= 30;
      next.fat_loss -= 20;
      next.rehab_general -= 25;
      next.upper_maintain = (next.upper_maintain || 0) - 45;
      next.lower_maintain = (next.lower_maintain || 0) - 45;
      next.full_maintain = (next.full_maintain || 0) - 30;
    }
    if (goal === 'rehab' && condition === 'none') next.cervical_rehab += 8;
    if (/목|경추|거북목/.test(profile.injuryNotes || '')) next.cervical_rehab += 35;

    if (condition === 'lumbar_disc') {
      next.lumbar_rehab += 60;
      next.functional_cardio -= 25;
      next.fat_loss -= 15;
      next.core_stability += 28;
      next.rehab_general -= 25;
      next.upper_maintain = (next.upper_maintain || 0) - 40;
      next.lower_maintain = (next.lower_maintain || 0) - 35;
      next.full_maintain = (next.full_maintain || 0) - 30;
    }
    if (/허리|요추|좌골|디스크/.test(profile.injuryNotes || '')) next.lumbar_rehab += 35;

    if (condition === 'rehab_general') {
      next.rehab_general += 42;
      next.functional_cardio -= 15;
    }
    if (goal === 'rehab') next.rehab_general += 30;
    if (profile.experience === 'beginner' && goal === 'rehab') next.rehab_general += 12;

    if (avgRecovery < 70 && avgRecovery >= 45) next.mobility += 20;
    if (goal === 'maintain' || goal === 'rehab') next.mobility += 12;
    if (profile.age && profile.age >= 50) next.mobility += 10;

    if (goal === 'rehab' || condition === 'lumbar_disc') next.core_stability += 22;
    if (lowerSessions >= 2 && condition === 'lumbar_disc') next.core_stability += 10;

    if (goal === 'maintain') next.full_maintain += 18;

    if (condition === 'cervical_disc' || condition === 'lumbar_disc') {
      next.upper_growth = (next.upper_growth || 0) - 35;
      next.lower_growth = (next.lower_growth || 0) - 35;
    }
    if (goal === 'rehab') {
      next.upper_growth = (next.upper_growth || 0) - 20;
      next.lower_growth = (next.lower_growth || 0) - 20;
    }

    return next;
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

  function getGoalLabel(settings) {
    if (typeof UserProfile === 'undefined' || !settings) return '';
    const p = UserProfile.normalize(settings.profile);
    if (!UserProfile.isComplete(p)) return '';
    return UserProfile.GOAL_OPTIONS[p.goal]?.label || '';
  }

  function buildReason(id, stats, settings) {
    const meta = TYPE_META[id];
    const goalSuffix = () => {
      const label = getGoalLabel(settings);
      return label ? ` · 목표: ${label}` : '';
    };

    if (meta.category === 'rehab' || meta.mode === 'rehab') {
      const condition = detectEffectiveCondition(
        typeof UserProfile !== 'undefined' ? UserProfile.normalize(settings?.profile) : {}
      );
      const conditionLabel = typeof UserProfile !== 'undefined' && condition !== 'none'
        ? UserProfile.getConditionLabel(condition)
        : '회복·통증 관리';
      if (id === 'cervical_rehab') {
        return `현재 상태: ${conditionLabel} · 목·어깨 안정화 루틴 추천${goalSuffix()}`;
      }
      if (id === 'lumbar_rehab') {
        return `현재 상태: ${conditionLabel} · 허리·골반 안정화 루틴 추천${goalSuffix()}`;
      }
      if (id === 'core_stability') {
        return `코어·허리 안정화가 필요해 보여요 · 저강도 코어 루틴 추천${goalSuffix()}`;
      }
      return `재활·회복 중심 루틴 · 통증 없는 범위에서 진행${goalSuffix()}`;
    }

    if (meta.category === 'cardio' || meta.mode === 'cardio') {
      const cardioMin = stats.cardioMinutes;
      const sessions = stats.cardioSessions;
      if (id === 'fat_loss') {
        return `최근 ${LOOKBACK_DAYS}일 유산소 ${cardioMin}분 · 근력+저충격 루틴으로 체중 관리 추천${goalSuffix()}`;
      }
      return `최근 ${LOOKBACK_DAYS}일 유산소 ${sessions}회(${cardioMin}분) · 기능성 유산소 보강 추천${goalSuffix()}`;
    }

    if (meta.mode === 'mobility') {
      return `평균 회복 ${Math.round(stats.avgRecovery)}% · 가동성·스트레칭으로 몸 풀기 추천${goalSuffix()}`;
    }

    if (id === 'full_maintain') {
      return `상체 ${stats.upperSessions}회 · 하체 ${stats.lowerSessions}회 균형 → 전신 유지 루틴 추천${goalSuffix()}`;
    }

    const regionLabel = meta.workoutType === 'upper' ? '상체' : '하체';
    const recPct = Math.round(meta.workoutType === 'upper' ? stats.upperRec : stats.lowerRec);
    const daysSince = meta.workoutType === 'upper' ? stats.daysSinceUpper : stats.daysSinceLower;
    const sessions = meta.workoutType === 'upper' ? stats.upperSessions : stats.lowerSessions;

    if (meta.mode === 'growth') {
      return `${regionLabel} 회복 ${recPct}% · 마지막 ${regionLabel} 운동 ${daysSince}일 전 · 최근 ${LOOKBACK_DAYS}일 ${sessions}회 → 점진적 과부하 추천${goalSuffix()}`;
    }
    return `${regionLabel} 회복 ${recPct}% · 최근 ${LOOKBACK_DAYS}일 ${sessions}회 운동 → 평소 루틴 유지 추천${goalSuffix()}`;
  }

  function getTipForType(id) {
    const meta = TYPE_META[id];
    return TIPS[meta.mode] || TIPS.maintain;
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
    if (exercise.mode === 'duration') {
      return {
        name: exercise.name,
        mode: 'duration',
        durationMin: exercise.durationMin || 1,
        sets: exercise.sets || 1,
      };
    }

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
    const presets = EXERCISE_PRESETS[id];

    if (presets && (meta.category === 'rehab' || meta.category === 'cardio' || meta.mode === 'mobility')) {
      return presets
        .slice(0, MAX_SUGGESTED_EXERCISES)
        .map(ex => exerciseToPrefill(ex, meta.mode));
    }

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
      .map(([name]) => name);

    const fromHistory = ranked
      .slice(0, MAX_SUGGESTED_EXERCISES)
      .map(name => exerciseToPrefill(getRepresentativeExercise(source, name), meta.mode));

    if (fromHistory.length >= 3) return fromHistory;

    const fallback = (presets || EXERCISE_PRESETS.full_maintain || [])
      .slice(0, MAX_SUGGESTED_EXERCISES)
      .map(ex => exerciseToPrefill(ex, meta.mode));

    const seen = new Set();
    const merged = [];
    [...fromHistory, ...fallback].forEach(ex => {
      if (seen.has(ex.name)) return;
      seen.add(ex.name);
      merged.push(ex);
    });
    return merged.slice(0, MAX_SUGGESTED_EXERCISES);
  }

  function buildRecommendation(workouts, stats, typeId, settings) {
    const meta = TYPE_META[typeId];
    return {
      id: typeId,
      ...meta,
      reason: buildReason(typeId, stats, settings),
      tip: getTipForType(typeId),
      exercises: buildSuggestedExercises(workouts, typeId),
      stats,
    };
  }

  function buildStats(workouts, settings) {
    const recovery = calcMuscleRecovery(workouts, settings);
    const recent = WorkoutUtils.getWorkoutsInLookback(workouts, LOOKBACK_DAYS);
    const weekRecent = WorkoutUtils.getWorkoutsInLookback(workouts, 7);
    const weekSessionCount = countWeekSessions(workouts);

    const allMuscles = [...UPPER_MUSCLES, ...LOWER_MUSCLES];
    const activeMuscles = allMuscles.filter(m => recovery[m]?.lastDate);
    const avgRecovery = activeMuscles.length === 0
      ? 100
      : activeMuscles.reduce((sum, m) => sum + recovery[m].recoveryPct, 0) / activeMuscles.length;

    const stats = {
      upperRec: getRegionRecoveryAvg(recovery, UPPER_MUSCLES),
      lowerRec: getRegionRecoveryAvg(recovery, LOWER_MUSCLES),
      upperSessions: countRegionSessions(recent, 'upper'),
      lowerSessions: countRegionSessions(recent, 'lower'),
      upperVol: getRegionVolume(recent, UPPER_MUSCLES),
      lowerVol: getRegionVolume(recent, LOWER_MUSCLES),
      daysSinceUpper: daysSinceLastRegionSession(workouts, 'upper'),
      daysSinceLower: daysSinceLastRegionSession(workouts, 'lower'),
      cardioSessions: countRegionSessions(recent, 'cardio'),
      cardioMinutes: getCardioMinutes(recent),
      weekCardioMinutes: getCardioMinutes(weekRecent),
      avgRecovery,
      historyDays: getHistorySpanDays(workouts),
      weekSessionCount,
    };

    let scores = scoreStrengthRecommendations(stats);
    scores = applyProfileScores(scores, settings, weekSessionCount);
    scores = scoreExtendedRecommendations(scores, stats, settings);
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
    return TYPE_GROUPS.map(group => {
      const options = group.ids.map(id => {
        const meta = TYPE_META[id];
        const isAuto = id === autoTypeId;
        const suffix = isAuto ? ' ★ 추천' : '';
        return `<option value="${id}"${id === selectedTypeId ? ' selected' : ''}>${meta.icon} ${meta.label}${suffix}</option>`;
      }).join('');
      return `<optgroup label="${group.label}">${options}</optgroup>`;
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
              ? `기록 ${remain}일 더 쌓이면 맞춤 운동 유형 추천을 알려드려요.`
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

  return {
    compute,
    render,
    apply,
    setType,
    TYPE_META,
    TYPE_ORDER,
    TYPE_GROUPS,
    EXERCISE_PRESETS,
    detectEffectiveCondition,
    buildStats,
    scoreStrengthRecommendations,
    scoreExtendedRecommendations,
  };
})();
