// ============================================================
// RECOVR - 운동 조언 모듈 (rule-based, 로컬 전용)
// 기록된 운동 패턴을 분석해 부족한 부위, 균형, 허리/디스크 주의를 알려줍니다.
// ============================================================

const WorkoutAdvice = (() => {
  const LOOKBACK_DAYS = 14;
  const MIN_SESSION_COUNT = 2;

  const PUSH_MUSCLES = ['chest', 'shoulder', 'triceps'];
  const PULL_MUSCLES = ['back', 'biceps'];
  const LOWER_MUSCLES = WorkoutUtils.LOWER_MUSCLES;
  const UPPER_MUSCLES = WorkoutUtils.UPPER_MUSCLES;

  const SPINAL_LOAD_KEYWORDS = [
    '데드리프트', '데드', '굿모닝', '백 익스텐션', '벤트오버',
    '스쿼트', '오버헤드', '밀리터리', '숄더프레스', '쇼울더 프레스',
    'rdl', '루마니안', '스티프 레그', '굿 모닝',
  ];

  const CORE_SUGGESTIONS = ['플랭크', '데드버그', '버드독', '행잉 레그레이즈'];
  const MOBILITY_SUGGESTIONS = ['스트레칭', '모빌리티', '폼롤러', '고관절'];

  function getMuscleVolumeMap(workouts) {
    const map = {};
    MUSCLE_ORDER.forEach(m => { map[m] = 0; });

    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        if (!ex.name || ex.mode === 'duration') return;
        const vol = getExerciseVolume(ex);
        getMusclesFromExerciseName(ex.name).forEach(m => {
          map[m] = (map[m] || 0) + vol;
        });
      });
    });

    return map;
  }

  function getMuscleSessionCounts(workouts) {
    const counts = {};
    MUSCLE_ORDER.forEach(m => { counts[m] = 0; });

    workouts.forEach(w => {
      const hit = new Set();
      (w.exercises || []).forEach(ex => {
        if (!ex.name || ex.mode === 'duration') return;
        getMusclesFromExerciseName(ex.name).forEach(m => hit.add(m));
      });
      hit.forEach(m => { counts[m] = (counts[m] || 0) + 1; });
    });

    return counts;
  }

  function sumVolume(map, keys) {
    return keys.reduce((sum, k) => sum + (map[k] || 0), 0);
  }

  function getTrainedMuscles(workouts) {
    const trained = new Set();
    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        if (!ex.name || ex.mode === 'duration') return;
        getMusclesFromExerciseName(ex.name).forEach(m => trained.add(m));
      });
    });
    return trained;
  }

  function countSpinalLoadSessions(workouts) {
    let count = 0;
    workouts.forEach(w => {
      const hasSpinal = (w.exercises || []).some(ex => {
        if (!ex.name || ex.mode === 'duration') return false;
        const norm = normalizeExerciseName(ex.name);
        return SPINAL_LOAD_KEYWORDS.some(kw => norm.includes(normalizeExerciseName(kw)));
      });
      if (hasSpinal) count++;
    });
    return count;
  }

  function hasMobilityWork(workouts) {
    return workouts.some(w =>
      (w.exercises || []).some(ex => {
        const activities = getActivityTagsFromExerciseName(ex.name);
        if (activities.includes('mobility')) return true;
        const norm = normalizeExerciseName(ex.name);
        return MOBILITY_SUGGESTIONS.some(kw => norm.includes(normalizeExerciseName(kw)));
      })
    );
  }

  function hasCoreWork(workouts) {
    return workouts.some(w =>
      (w.exercises || []).some(ex => {
        const muscles = getMusclesFromExerciseName(ex.name);
        if (muscles.includes('core')) return true;
        const norm = normalizeExerciseName(ex.name);
        return CORE_SUGGESTIONS.some(kw => norm.includes(normalizeExerciseName(kw)));
      })
    );
  }

  function findNeglectedMuscles(sessionCounts, trainedEver) {
    const neglected = [];
    const priority = ['hamstrings', 'adductors', 'core', 'calves', 'forearms'];

    priority.forEach(m => {
      if (!trainedEver.has(m)) {
        neglected.push({ muscle: m, reason: 'never' });
      } else if ((sessionCounts[m] || 0) === 0) {
        neglected.push({ muscle: m, reason: 'recent_zero' });
      } else if ((sessionCounts[m] || 0) === 1) {
        neglected.push({ muscle: m, reason: 'recent_low' });
      }
    });

    return neglected.slice(0, 2);
  }

  function muscleSuggestion(muscle) {
    const tips = {
      hamstrings: '레그 컬, RDL, 힙 쓰러스트를 추가해보세요.',
      adductors: '힙 어덕션/어브덕션 머신이나 코펜하겐 플랭크를 고려해보세요.',
      core: '플랭크, 데드버그, 행잉 레그레이즈로 코어를 보강하세요.',
      calves: '스탠딩/시티드 카프레이즈를 루틴에 넣어보세요.',
      forearms: '리스트 컬이나 그립 운동을 가볍게 추가해보세요.',
      back: '랫풀다운, 로우 계열을 추가해보세요.',
      chest: '벤치프레스, 체스트프레스를 추가해보세요.',
      shoulder: '숄더프레스, 레터럴 레이즈를 추가해보세요.',
      quads: '스쿼트, 레그프레스, 런지를 추가해보세요.',
    };
    return tips[muscle] || `${MUSCLE_LABELS[muscle]?.name || muscle} 운동을 보강해보세요.`;
  }

  function compute(workouts) {
    if (workouts.length < MIN_SESSION_COUNT) return null;

    const recent = WorkoutUtils.getWorkoutsInLookback(workouts, LOOKBACK_DAYS);
    if (recent.length === 0) return null;

    const volumeMap = getMuscleVolumeMap(recent);
    const sessionCounts = getMuscleSessionCounts(recent);
    const trainedEver = getTrainedMuscles(workouts);
    const advice = [];

    const pushVol = sumVolume(volumeMap, PUSH_MUSCLES);
    const pullVol = sumVolume(volumeMap, PULL_MUSCLES);
    const upperVol = sumVolume(volumeMap, UPPER_MUSCLES);
    const lowerVol = sumVolume(volumeMap, LOWER_MUSCLES);

    if (pushVol > 0 && pullVol > 0 && pushVol > pullVol * 1.6) {
      advice.push({
        type: 'suggest',
        icon: '⚖️',
        title: '푸시·풀 균형',
        message: `최근 ${LOOKBACK_DAYS}일간 가슴·어깨·삼두 운동이 등·이두보다 많아요. 로우, 풀다운, 페이스 풀을 추가하면 어깨·등 균형에 도움이 됩니다.`,
      });
    } else if (pullVol > 0 && pushVol > 0 && pullVol > pushVol * 1.6) {
      advice.push({
        type: 'suggest',
        icon: '⚖️',
        title: '푸시·풀 균형',
        message: `최근 ${LOOKBACK_DAYS}일간 등·이두 운동이 가슴·어깨보다 많아요. 벤치프레스, 숄더프레스로 상체 균형을 맞춰보세요.`,
      });
    }

    if (upperVol > 0 && lowerVol > 0 && upperVol > lowerVol * 2) {
      advice.push({
        type: 'suggest',
        icon: '🦵',
        title: '하체 보강 추천',
        message: '상체 운동 비중이 높아요. 스쿼트, 레그프레스, 런지 등 하체 운동을 추가해보세요.',
      });
    } else if (lowerVol > 0 && upperVol > 0 && lowerVol > upperVol * 2) {
      advice.push({
        type: 'suggest',
        icon: '💪',
        title: '상체 보강 추천',
        message: '하체 운동 비중이 높아요. 등, 가슴, 어깨 운동을 함께 넣어 균형을 맞춰보세요.',
      });
    }

    const neglected = findNeglectedMuscles(sessionCounts, trainedEver);
    neglected.forEach(({ muscle, reason }) => {
      const label = MUSCLE_LABELS[muscle]?.name || muscle;
      const prefix = reason === 'never'
        ? `${label} 운동 기록이 없어요.`
        : reason === 'recent_zero'
          ? `최근 ${LOOKBACK_DAYS}일간 ${label} 운동이 없어요.`
          : `최근 ${LOOKBACK_DAYS}일간 ${label} 운동이 1회뿐이에요.`;
      advice.push({
        type: 'suggest',
        icon: MUSCLE_LABELS[muscle]?.icon || '🎯',
        title: `${label} 보강`,
        message: `${prefix} ${muscleSuggestion(muscle)}`,
      });
    });

    const spinalSessions = countSpinalLoadSessions(recent);
    const coreDone = hasCoreWork(recent);
    const mobilityDone = hasMobilityWork(recent);

    if (spinalSessions >= 2 && !coreDone) {
      advice.push({
        type: 'warning',
        icon: '⚠️',
        title: '허리·코어 주의',
        message: '데드리프트, 스쿼트 등 척추 부하가 큰 운동이 잦은데 코어 운동이 부족해요. 플랭크·데드버그로 복부 안정성을 먼저 키우는 것을 권장해요.',
      });
    }

    if (spinalSessions >= 3) {
      advice.push({
        type: 'warning',
        icon: '🦴',
        title: '디스크·허리 관리',
        message: `최근 ${LOOKBACK_DAYS}일간 척추 부하 운동이 ${spinalSessions}회 있어요. 무거운 데드리프트·굿모닝·과도한 벤트오버 로우는 디스크에 부담을 줄 수 있어요. 가벼운 무게·올바른 자세, 충분한 휴식을 지키세요.`,
      });
    }

    if (spinalSessions >= 1 && !mobilityDone) {
      advice.push({
        type: 'warning',
        icon: '🧘',
        title: '유연성·회복',
        message: '허리 부하 운동 후 스트레칭·모빌리티가 없어요. 고관절·햄스트링 스트레칭을 추가하면 허리 통증 예방에 도움이 됩니다.',
      });
    }

    const recovery = calcMuscleRecovery(workouts, loadSettings());
    const lowRecovery = MUSCLE_ORDER
      .filter(m => recovery[m].lastDate && recovery[m].recoveryPct < 50)
      .map(m => MUSCLE_LABELS[m].name);

    if (lowRecovery.length >= 2) {
      advice.push({
        type: 'info',
        icon: '💤',
        title: '회복 우선',
        message: `${lowRecovery.slice(0, 3).join(', ')} 부위 회복이 ${50}% 미만이에요. 오늘은 해당 부위를 쉬거나 가벼운 유지 운동만 하는 것이 좋아요.`,
      });
    }

    if (typeof CardioTracker !== 'undefined') {
      const cardioStats = CardioTracker.getWeeklyStats(workouts, LOOKBACK_DAYS);
      const strengthSessions = recent.filter(w => w.type !== 'cardio').length;

      if (strengthSessions >= 2 && cardioStats.sessionCount === 0) {
        advice.push({
          type: 'suggest',
          icon: '🏃',
          title: '유산소 추가 추천',
          message: `최근 ${LOOKBACK_DAYS}일간 근력 운동은 ${strengthSessions}회인데 유산소 기록이 없어요. 천국의계단, 로잉머신, 트레드밀 등 주 150분 유산소를 목표로 해보세요.`,
        });
      } else if (cardioStats.totalMinutes > 0 && cardioStats.totalMinutes < cardioStats.goalMinutes * 0.5) {
        advice.push({
          type: 'suggest',
          icon: '⏱️',
          title: '유산소 시간 부족',
          message: `이번 주 유산소 ${cardioStats.totalMinutes}분이에요. WHO 권장 주 ${cardioStats.goalMinutes}분의 ${cardioStats.goalPct}%입니다. 20~30분 가벼운 유산소를 추가해보세요.`,
        });
      } else if (cardioStats.goalPct >= 100) {
        advice.push({
          type: 'info',
          icon: '✅',
          title: '유산소 목표 달성',
          message: `이번 주 유산소 ${cardioStats.totalMinutes}분으로 주간 목표(${cardioStats.goalMinutes}분)를 달성했어요!`,
        });
      }
    }

    if (advice.length === 0) {
      advice.push({
        type: 'info',
        icon: '✅',
        title: '균형 잡힌 루틴',
        message: `최근 ${LOOKBACK_DAYS}일 기록을 보면 부위·상하체 균형이 괜찮아요. 지금 페이스를 유지하세요.`,
      });
    }

    return advice.slice(0, 4);
  }

  function render() {
    const container = document.getElementById('workoutAdviceCard');
    if (!container) return;

    const workouts = loadWorkouts();
    const items = compute(workouts);

    if (!items) {
      container.innerHTML = `
        <div class="advice-card advice-card--pending">
          <div class="advice-header-icon">💡</div>
          <div>
            <div class="advice-header-title">운동 조언</div>
            <div class="advice-item-msg" style="margin-top:4px">운동 ${MIN_SESSION_COUNT}회 이상 기록하면 패턴 분석 조언을 드려요.</div>
          </div>
        </div>`;
      return;
    }

    const listHtml = items.map(item => `
      <div class="advice-item advice-item--${item.type}">
        <div class="advice-item-icon">${item.icon}</div>
        <div class="advice-item-body">
          <div class="advice-item-title">${item.title}</div>
          <div class="advice-item-msg">${item.message}</div>
        </div>
      </div>`).join('');

    container.innerHTML = `
      <div class="advice-card">
        <div class="advice-header">
          <span class="advice-header-icon">💡</span>
          <span class="advice-header-title">운동 조언</span>
        </div>
        ${listHtml}
      </div>`;
  }

  return { compute, render };
})();
